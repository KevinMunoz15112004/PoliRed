import mongoose from 'mongoose'
import Conversacion from '../models/Conversaciones.js'
import Mensaje from '../models/Mensajes.js'
import Estudiante from '../models/Estudiantes.js'
import socketEvents from '../socketEvents.js'

// Compute deterministic pairHash for two user ids (sorted)
const computePairHash = (a, b) => [String(a), String(b)].sort().join('_')

async function createOrGetConversation(userId, targetId) {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(targetId)) {
    throw { status: 400, msg: 'IDs inválidos' }
  }
  if (String(userId) === String(targetId)) {
    throw { status: 400, msg: 'No puedes crearte una conversación a ti mismo' }
  }

  const target = await Estudiante.findById(targetId).select('nombre apellido username fotoPerfil')
  if (!target) throw { status: 404, msg: 'Estudiante destino no encontrado' }

  const pairHash = computePairHash(userId, targetId)

  // Use atomic upsert to avoid race conditions
  const filter = { pairHash }
  const update = {
    $setOnInsert: {
      participantes: [userId, targetId],
      ultimaActividad: new Date(),
    }
  }
  const opts = { upsert: true, new: true, setDefaultsOnInsert: true }

  try {
    const conversacion = await Conversacion.findOneAndUpdate(filter, update, opts).populate('participantes', 'nombre apellido username fotoPerfil')
    return conversacion
  } catch (err) {
    // Handle duplicate key race: another process created the doc between operations
    if (err && err.code === 11000) {
      const existente = await Conversacion.findOne({ pairHash }).populate('participantes', 'nombre apellido username fotoPerfil')
      if (existente) return existente
    }
    throw err
  }
}

async function getConversationsForUser(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) throw { status: 400, msg: 'userId inválido' }
  const conversaciones = await Conversacion.find({ participantes: userId })
    .sort({ ultimaActividad: -1, updatedAt: -1 })
    .populate('participantes', 'nombre apellido username fotoPerfil')
    .lean()

  // Calcular unreadCount para cada conversación con una sola agregación
  const convIds = conversaciones.map(c => c._id).filter(Boolean)
  let unreadMap = {}
  if (convIds.length > 0) {
    const counts = await Mensaje.aggregate([
      { $match: { conversacionId: { $in: convIds.map(id => mongoose.Types.ObjectId(id)) }, destinatario: mongoose.Types.ObjectId(userId), leido: false } },
      { $group: { _id: '$conversacionId', count: { $sum: 1 } } }
    ])
    unreadMap = counts.reduce((acc, cur) => { acc[String(cur._id)] = cur.count; return acc }, {})
  }

  return conversaciones.map(c => {
    const otros = c.participantes.filter(p => String(p._id) !== String(userId))
    const otro = otros.length > 0 ? otros[0] : null
    const unread = unreadMap[String(c._id)] || 0
    return {
      id: c._id,
      participante: otro,
      ultimoMensaje: c.ultimoMensaje || null,
      ultimaActividad: c.ultimaActividad || c.updatedAt,
      unreadCount: unread
    }
  })
}

async function getMessagesForConversation(conversacionId, userId, page = 1, limit = 20) {
  if (!mongoose.Types.ObjectId.isValid(conversacionId)) throw { status: 400, msg: 'conversacionId inválido' }
  if (!mongoose.Types.ObjectId.isValid(userId)) throw { status: 400, msg: 'userId inválido' }

  const conversacion = await Conversacion.findById(conversacionId)
  if (!conversacion) throw { status: 404, msg: 'Conversación no encontrada' }
  if (!conversacion.participantes.some(p => String(p) === String(userId))) throw { status: 403, msg: 'No tienes acceso a esta conversación' }

  const p = Math.max(parseInt(page, 10) || 1, 1)
  const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100)
  const skip = (p - 1) * l

  // Primero identificar mensajes que deben marcarse como leídos
  let mensajesIdsMarcados = []
  try {
    const pendientes = await Mensaje.find({ conversacionId, destinatario: userId, leido: false }).select('_id').lean()
    mensajesIdsMarcados = pendientes.map(d => d._id)
    if (mensajesIdsMarcados.length > 0) {
      await Mensaje.updateMany({ _id: { $in: mensajesIdsMarcados } }, { $set: { leido: true } })
      // Notificar a capa de sockets que estos mensajes fueron leídos
      try {
        socketEvents.emit('mensajes_leidos', {
          conversacionId: String(conversacionId),
          lectorId: String(userId),
          mensajesActualizados: mensajesIdsMarcados.map(String),
          timestamp: new Date().toISOString()
        })
      } catch (ee) {
        console.error('Error emitiendo evento mensajes_leidos:', ee)
      }
    }
  } catch (e) {
    console.error('Error preparando marcado de leídos:', e)
  }

  const total = await Mensaje.countDocuments({ conversacionId })
  const mensajes = await Mensaje.find({ conversacionId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(l)
    .populate('autor', 'nombre apellido username fotoPerfil')

  return { page: p, limit: l, total, items: mensajes.reverse() }
}

// Save a message and update conversation; returns populated message
async function saveMessage(conversacionId, authorId, contenido) {
  if (!mongoose.Types.ObjectId.isValid(conversacionId)) throw { status: 400, msg: 'conversacionId inválido' }
  if (!mongoose.Types.ObjectId.isValid(authorId)) throw { status: 400, msg: 'authorId inválido' }
  if (!contenido || !String(contenido).trim()) throw { status: 400, msg: 'Contenido requerido' }

  const conversacion = await Conversacion.findById(conversacionId)
  if (!conversacion) throw { status: 404, msg: 'Conversación no encontrada' }
  if (!conversacion.participantes.some(p => String(p) === String(authorId))) throw { status: 403, msg: 'No eres participante de esta conversación' }

  const destinatarioId = conversacion.participantes.find(p => String(p) !== String(authorId))
  if (!destinatarioId) throw { status: 400, msg: 'Destinatario no encontrado' }

  // Persist message first
  const nuevo = await Mensaje.create({ conversacionId, autor: authorId, destinatario: destinatarioId, contenido: String(contenido).trim() })

  // Update conversation metadata (not strictly transactional here)
  conversacion.ultimoMensaje = { contenido: nuevo.contenido, autorId: authorId, fecha: nuevo.createdAt }
  conversacion.ultimaActividad = new Date()
  await conversacion.save()

  const mensajePop = await Mensaje.findById(nuevo._id).populate('autor', 'nombre apellido username fotoPerfil')
  return { mensaje: mensajePop, destinatarioId }
}

export { createOrGetConversation, getConversationsForUser, getMessagesForConversation, saveMessage }
