import { Router } from 'express'
import { sendMessage, getOrCreateConversation, getConversationMessages, markAsRead, pusherAuth, pusherStatus } from '../controllers/mensajesController.js'
import { verifyToken } from '../middlewares/auth.js'

const router = Router()

// Enviar mensaje (crea conversación si no existe)
router.post('/send', verifyToken, sendMessage)

// Obtener o crear conversación entre dos usuarios y traer últimos mensajes
router.get('/entre/:otherId', verifyToken, getOrCreateConversation)

// Cargar mensajes de una conversación (paginación simple)
router.get('/conversacion/:id', verifyToken, getConversationMessages)

// Marcar como leídos los mensajes del destinatario en una conversación
router.post('/:conversacionId/leidos', verifyToken, markAsRead)

// Pusher auth for private/presence channels
router.post('/pusher/auth', verifyToken, pusherAuth)

// Notify contacts that user is online/offline
router.post('/pusher/status', verifyToken, pusherStatus)

export default router
