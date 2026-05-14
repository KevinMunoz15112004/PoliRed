import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import validateResult from '../validators/validateResult.js'
import validators from '../validators/index.js'
import { crearConversacion, listarConversaciones, listarMensajesConversacion, enviarMensajeConversacion } from '../controllers/mensajesController.js'

const router = Router()

// Crear o reutilizar conversación 1:1 con otro estudiante
router.post('/mensajes/conversaciones', verifyToken, validators.mongoIdBody('targetId'), validateResult, crearConversacion)

// Listar conversaciones del usuario autenticado
router.get('/mensajes/conversaciones', verifyToken, listarConversaciones)

// Enviar mensaje (persistir)
router.post('/mensajes/conversaciones/:conversacionId', verifyToken, validators.mongoIdParam('conversacionId'), validateResult, enviarMensajeConversacion)

// Obtener historial paginado de una conversación
router.get('/mensajes/conversaciones/:conversacionId', verifyToken, validators.mongoIdParam('conversacionId'), validateResult, listarMensajesConversacion)

export default router