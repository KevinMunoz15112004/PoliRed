import Notificacion from '../models/Notificaciones.js'

export const crearNotificacion = async ({
  usuarioId,
  emisorId = null,
  tipo,
  publicacionId = null,
  comentarioId = null,
  conversacionId = null,
  mensaje = null
}) => {
  try {
    const notificacion = await Notificacion.create({
      usuarioId,
      emisorId,
      tipo,
      publicacionId,
      comentarioId,
      conversacionId,
      mensaje
    })
    return notificacion
  } catch (error) {
    console.error('Error al crear notificación:', error)
    throw error
  }
}
