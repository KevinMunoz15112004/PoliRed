import { createOrGetConversation, getConversationsForUser, getMessagesForConversation, saveMessage } from '../services/mensajesService.js'
import { crearNotificacion } from '../helpers/notificaciones.js'

const crearConversacion = async (req, res) => {
  try {
    const usuarioId = req.user?._id
    const { targetId } = req.body
    const conversacion = await createOrGetConversation(usuarioId, targetId)
    // HTTP status: 200 if existed, 201 if just created — service cannot easily distinguish, return 200 for idempotency
    return res.status(200).json({ conversacion })
  } catch (err) {
    console.error('crearConversacion error', err)
    const status = err && err.status ? err.status : 500
    return res.status(status).json({ msg: err.msg || 'Error en el servidor' })
  }
}

const listarConversaciones = async (req, res) => {
  try {
    const usuarioId = req.user?._id
    const conversaciones = await getConversationsForUser(usuarioId)
    return res.status(200).json({ conversaciones })
  } catch (err) {
    console.error('listarConversaciones error', err)
    const status = err && err.status ? err.status : 500
    return res.status(status).json({ msg: err.msg || 'Error en el servidor' })
  }
}

const listarMensajesConversacion = async (req, res) => {
  try {
    const usuarioId = req.user?._id
    const { conversacionId } = req.params
    const page = req.query.page
    const limit = req.query.limit
    const result = await getMessagesForConversation(conversacionId, usuarioId, page, limit)
    return res.status(200).json(result)
  } catch (err) {
    console.error('listarMensajesConversacion error', err)
    const status = err && err.status ? err.status : 500
    return res.status(status).json({ msg: err.msg || 'Error en el servidor' })
  }
}

const enviarMensajeConversacion = async (req, res) => {
  try {
    const usuarioId = req.user?._id
    const { conversacionId } = req.params
    const { contenido } = req.body
    const { mensaje, destinatarioId } = await saveMessage(conversacionId, usuarioId, contenido)

    // Crear notificación (si aplica)
    try {
      await crearNotificacion({ usuarioId: destinatarioId, emisorId: usuarioId, tipo: 'mensaje', conversacionId, mensaje: mensaje.contenido })
    } catch (e) {
      console.error('Error creando notificación mensaje:', e)
    }

    return res.status(201).json({ mensaje })
  } catch (err) {
    console.error('enviarMensajeConversacion error', err)
    const status = err && err.status ? err.status : 500
    return res.status(status).json({ msg: err.msg || 'Error en el servidor' })
  }
}

export { crearConversacion, listarConversaciones, listarMensajesConversacion, enviarMensajeConversacion }
