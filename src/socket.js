import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import Estudiante from './models/Estudiantes.js'
import Conversacion from './models/Conversaciones.js'
import { saveMessage } from './services/mensajesService.js'
import mongoose from 'mongoose'

export const configurarSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*',
      credentials: true
    }
  })

  // Map userId => Set(socketId)
  const usuariosConectados = new Map()

  // Auth middleware for socket handshake using token in auth or headers
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || (socket.handshake.headers && socket.handshake.headers.authorization ? String(socket.handshake.headers.authorization).split(' ')[1] : null)
      if (!token) return next(new Error('Token no proporcionado'))
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      const user = await Estudiante.findById(payload.id).select('-password').lean()
      if (!user) return next(new Error('Usuario no encontrado'))
      socket.user = user
      return next()
    } catch (err) {
      console.error('Socket auth error:', err.message)
      return next(new Error('Autenticación Socket inválida'))
    }
  })

  io.on('connection', (socket) => {
    const userId = String(socket.user._id)
    // register socket
    const prevSet = usuariosConectados.get(userId)
    const wasOnline = Boolean(prevSet && prevSet.size > 0)
    const set = prevSet || new Set()
    set.add(socket.id)
    usuariosConectados.set(userId, set)
    console.log(`Usuario ${userId} conectado en socket ${socket.id}`)

    // Emitir evento de presencia solo cuando el usuario se conecta por PRIMERA vez
    if (!wasOnline) {
      try {
        io.emit('usuario:online', { userId })
      } catch (e) {
        console.error('Error emitiendo usuario:online', e)
      }
    }

    // Helper to emit to a user (all sockets)
    const emitToUser = (uid, event, payload) => {
      const sockets = usuariosConectados.get(String(uid))
      if (!sockets) return
      for (const sid of sockets) io.to(sid).emit(event, payload)
    }

    socket.on('join:conversacion', async (conversacionId) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(conversacionId)) return socket.emit('chat:error', { msg: 'conversacionId inválido' })
        const conversacion = await Conversacion.findById(conversacionId)
        if (!conversacion) return socket.emit('chat:error', { msg: 'Conversación no encontrada' })
        if (!conversacion.participantes.some(p => String(p) === userId)) return socket.emit('chat:error', { msg: 'No tienes acceso a esta conversación' })
        socket.join(conversacionId)
      } catch (e) {
        console.error('join:conversacion error', e)
        socket.emit('chat:error', { msg: 'Error al unirse a la conversación' })
      }
    })

    socket.on('mensaje:enviar', async ({ conversacionId, contenido }) => {
      try {
        if (!conversacionId || !contenido) return socket.emit('chat:error', { msg: 'Datos incompletos' })
        if (!mongoose.Types.ObjectId.isValid(conversacionId)) return socket.emit('chat:error', { msg: 'conversacionId inválido' })
        // Use service to persist and update conversation
        const { mensaje, destinatarioId } = await saveMessage(conversacionId, userId, contenido)

        // Emitir al room de la conversacion
        io.to(conversacionId).emit('mensaje:nuevo', { conversacionId, mensaje })

        // Evitar duplicados: emitir solo a sockets del destinatario que NO estén ya en la room
        const roomSockets = io.sockets.adapter.rooms.get(conversacionId) || new Set()
        const destSockets = usuariosConectados.get(String(destinatarioId)) || new Set()
        for (const sid of destSockets) {
          if (!roomSockets.has(sid)) {
            io.to(sid).emit('mensaje:nuevo', { conversacionId, mensaje })
          }
        }

        // Confirmación al remitente: emitir solo a sockets del remitente que NO estén ya en la room
        const senderSockets = usuariosConectados.get(String(userId)) || new Set()
        for (const sid of senderSockets) {
          if (!roomSockets.has(sid)) {
            io.to(sid).emit('mensaje:enviado', { conversacionId, mensaje })
          }
        }
      } catch (e) {
        console.error('mensaje:enviar error', e)
        socket.emit('chat:error', { msg: 'Error enviando mensaje' })
      }
    })

    socket.on('disconnect', () => {
      const sockets = usuariosConectados.get(userId)
      if (sockets) {
        sockets.delete(socket.id)
        if (sockets.size === 0) {
          usuariosConectados.delete(userId)
          // Emitir evento de presencia offline cuando se desconecta el ÚLTIMO socket
          try {
            io.emit('usuario:offline', { userId })
          } catch (e) {
            console.error('Error emitiendo usuario:offline', e)
          }
        } else {
          usuariosConectados.set(userId, sockets)
        }
      }
      console.log(`Usuario ${userId} desconectado de socket ${socket.id}`)
    })
  })
}
