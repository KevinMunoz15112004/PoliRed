import Mensaje from '../models/Mensajes.js'
import Conversacion from '../models/Conversaciones.js'
import Estudiante from '../models/Estudiantes.js'
import pusher, { triggerUserChannel } from '../config/pusher.js'

export async function sendMessage(req, res) {
  try {
    const autorId = req.user._id
    const { destinatarioId, contenido } = req.body
    if (!destinatarioId || !contenido) return res.status(400).json({ msg: 'Datos incompletos' })
    if (String(destinatarioId) === String(autorId)) return res.status(400).json({ msg: 'No puedes enviarte mensajes a ti mismo' })

    const destinatario = await Estudiante.findById(destinatarioId).select('-password').lean()
    if (!destinatario) return res.status(404).json({ msg: 'Destinatario no encontrado' })

    const ids = [String(autorId), String(destinatarioId)].sort()
    const pairHash = ids.join('_')

    let conversacion = await Conversacion.findOne({ pairHash })
    if (!conversacion) {
      conversacion = await Conversacion.create({ participantes: [autorId, destinatarioId] })
    }

    const mensaje = await Mensaje.create({
      conversacionId: conversacion._id,
      autor: autorId,
      destinatario: destinatarioId,
      contenido
    })

    // actualizar metadatos de conversación
    conversacion.ultimoMensaje = {
      contenido,
      autorId: autorId,
      fecha: mensaje.createdAt
    }
    conversacion.ultimaActividad = new Date()
    await conversacion.save()

    const payload = {
      mensaje: {
        _id: mensaje._id,
        conversacionId: conversacion._id,
        autor: autorId,
        destinatario: destinatarioId,
        contenido,
        leido: mensaje.leido,
        createdAt: mensaje.createdAt
      },
      conversacion: {
        _id: conversacion._id,
        participantes: conversacion.participantes,
        ultimoMensaje: conversacion.ultimoMensaje
      }
    }

    // Notificar destinatario y autor para sincronizar UI
    try {
      await triggerUserChannel(destinatarioId, 'nuevo_mensaje', payload)
    } catch (e) {
      console.warn('Pusher notify destinatario falló:', e.message || e)
    }
    try {
      await triggerUserChannel(autorId, 'nuevo_mensaje_local', payload)
    } catch (e) {
      console.warn('Pusher notify autor falló:', e.message || e)
    }

    return res.status(201).json({ mensaje: payload.mensaje, conversacion: payload.conversacion })
  } catch (err) {
    console.error('sendMessage error', err)
    return res.status(500).json({ msg: 'Error interno' })
  }
}

export async function getConversationMessages(req, res) {
  try {
    const { id } = req.params
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const page = Math.max(parseInt(req.query.page) || 0, 0)

    const conversacion = await Conversacion.findById(id).lean()
    if (!conversacion) return res.status(404).json({ msg: 'Conversación no encontrada' })

    const userId = String(req.user._id)
    const participants = (conversacion.participantes || []).map(String)
    if (!participants.includes(userId)) return res.status(403).json({ msg: 'No tienes acceso a esta conversación' })

    const mensajes = await Mensaje.find({ conversacionId: id })
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit)
      .lean()

    // devolver en orden cronológico ascendente
    return res.json({ mensajes: mensajes.reverse(), page, limit })
  } catch (err) {
    console.error('getConversationMessages error', err)
    return res.status(500).json({ msg: 'Error interno' })
  }
}

export async function getOrCreateConversation(req, res) {
  try {
    const userId = String(req.user._id)
    const otherId = req.params.otherId
    if (!otherId) return res.status(400).json({ msg: 'Falta otherId' })
    if (String(otherId) === userId) return res.status(400).json({ msg: 'No puedes crear conversación contigo mismo' })

    const other = await Estudiante.findById(otherId).select('-password').lean()
    if (!other) return res.status(404).json({ msg: 'Usuario no encontrado' })

    const ids = [userId, String(otherId)].sort()
    const pairHash = ids.join('_')

    let conversacion = await Conversacion.findOne({ pairHash })
    if (!conversacion) {
      conversacion = await Conversacion.create({ participantes: [userId, otherId] })
    }

    // traer últimos mensajes (por defecto 50)
    const mensajes = await Mensaje.find({ conversacionId: conversacion._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    return res.json({ conversacion, mensajes: mensajes.reverse() })
  } catch (err) {
    console.error('getOrCreateConversation error', err)
    return res.status(500).json({ msg: 'Error interno' })
  }
}

export async function markAsRead(req, res) {
  try {
    const userId = String(req.user._id)
    const { conversacionId } = req.params
    if (!conversacionId) return res.status(400).json({ msg: 'conversacionId requerido' })

    const conversacion = await Conversacion.findById(conversacionId).lean()
    if (!conversacion) return res.status(404).json({ msg: 'Conversación no encontrada' })
    const participants = (conversacion.participantes || []).map(String)
    if (!participants.includes(userId)) return res.status(403).json({ msg: 'No tienes acceso a esta conversación' })

    const result = await Mensaje.updateMany({ conversacionId, destinatario: userId, leido: false }, { $set: { leido: true } })

    // Notificar al otro participante que sus mensajes fueron leídos
    const other = participants.find(p => p !== userId)
    if (other) {
      try {
        await triggerUserChannel(other, 'mensajes_leidos', { conversacionId, lector: userId })
      } catch (e) {
        console.warn('Pusher notify leido falló:', e.message || e)
      }
    }

    return res.json({ modifiedCount: result.modifiedCount || result.nModified || 0 })
  } catch (err) {
    console.error('markAsRead error', err)
    return res.status(500).json({ msg: 'Error interno' })
  }
}

export async function pusherAuth(req, res) {
  const { socket_id, channel_name } = req.body
  if (!socket_id || !channel_name) return res.status(400).json({ msg: 'socket_id y channel_name son requeridos' })

  try {
    if (channel_name.startsWith('presence-')) {
      const presenceData = {
        user_id: String(req.user._id),
        user_info: {
          nombre: req.user.nombre || null,
          apellido: req.user.apellido || null,
          fotoPerfil: req.user.fotoPerfil || null
        }
      }
      const auth = pusher.authenticate(socket_id, channel_name, presenceData)
      return res.send(auth)
    }

    const auth = pusher.authenticate(socket_id, channel_name)
    return res.send(auth)
  } catch (e) {
    console.error('Pusher auth error', e)
    return res.status(500).json({ msg: 'Error autenticando canal' })
  }
}

export async function pusherStatus(req, res) {
  try {
    const { status } = req.body // 'online' | 'offline'
    if (!['online', 'offline'].includes(status)) return res.status(400).json({ msg: 'status inválido' })

    const userId = String(req.user._id)
    const convers = await Conversacion.find({ participantes: userId }).lean()
    const others = new Set()
    convers.forEach(c => {
      (c.participantes || []).map(String).forEach(p => { if (p !== userId) others.add(p) })
    })

    const payload = { userId, status, timestamp: new Date() }
    for (const other of others) {
      try {
        await triggerUserChannel(other, `user_${status}`, payload)
      } catch (e) {
        console.warn('Pusher notify status failed', e.message || e)
      }
    }

    return res.json({ notified: Array.from(others).length })
  } catch (e) {
    console.error('pusher status error', e)
    return res.status(500).json({ msg: 'Error interno' })
  }
}
