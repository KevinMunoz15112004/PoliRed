import { Router } from 'express'
import { verifyToken, requireRole } from '../middlewares/auth.js'
import { autenticarToken, isSuperAdmin } from '../middlewares/authSuperAdmin.js'
import {
  solicitarCreacionRed,
  unirseARedAprobada,
  salirDeRedComunitaria,
  crearPublicacionExtendida,
  darLikePublicacion,
  quitarLikePublicacion,
  crearComentarioPublicacion,
  responderComentario,
  listarComentariosArbol,
  guardarPublicacion,
  quitarGuardadoPublicacion,
  listarPublicacionesGuardadas,
  obtenerFeedPorRed,
  crearConversacion,
  listarConversaciones,
  enviarMensajeConversacion,
  listarMensajesConversacion,
  listarNotificaciones,
  marcarNotificacionLeida,
  subirArchivoMultimedia,
  marcarRedOficialAdmin,
  listarRedesPendientesAprobacion,
  resolverAprobacionRed,
  revocarAdminRed,
  asignarDuenoRed,
  eliminarPublicacionSuperAdmin
} from '../controllers/socialController.js'
import { crearReporte, listarReportesAdminRed } from '../controllers/reportesController.js'

const router = Router()

// Estudiantes
router.post('/redes/solicitar-creacion', verifyToken, solicitarCreacionRed)
router.post('/redes/unirse', verifyToken, unirseARedAprobada)
router.post('/redes/salir', verifyToken, salirDeRedComunitaria)

router.post('/publicaciones/extendida', verifyToken, crearPublicacionExtendida)
router.post('/publicaciones/:id/like', verifyToken, darLikePublicacion)
router.delete('/publicaciones/:id/like', verifyToken, quitarLikePublicacion)

router.post('/publicaciones/:id/comentarios', verifyToken, crearComentarioPublicacion)
router.post('/comentarios/:comentarioId/responder', verifyToken, responderComentario)
router.get('/publicaciones/:id/comentarios/arbol', verifyToken, listarComentariosArbol)

router.post('/publicaciones/:id/guardar', verifyToken, guardarPublicacion)
router.delete('/publicaciones/:id/guardar', verifyToken, quitarGuardadoPublicacion)
router.get('/usuarios/guardados', verifyToken, listarPublicacionesGuardadas)

router.get('/feed', verifyToken, obtenerFeedPorRed)

router.post('/mensajes/conversaciones', verifyToken, crearConversacion)
router.get('/mensajes/conversaciones', verifyToken, listarConversaciones)
router.post('/mensajes/conversaciones/:conversacionId', verifyToken, enviarMensajeConversacion)
router.get('/mensajes/conversaciones/:conversacionId', verifyToken, listarMensajesConversacion)

router.get('/notificaciones', verifyToken, listarNotificaciones)
router.patch('/notificaciones/:id/leida', verifyToken, marcarNotificacionLeida)

router.post('/multimedia/subir', verifyToken, subirArchivoMultimedia)

// Admin de red
router.patch('/admin/redes/:redId/oficial', verifyToken, requireRole('admin_red'), marcarRedOficialAdmin)
// Reportes: estudiantes crean, admin de red consulta los reportes de su red
router.post('/reportes', verifyToken, crearReporte)
router.get('/admin/reportes', verifyToken, requireRole('admin_red'), listarReportesAdminRed)

// Superadmin
router.get('/superadmin/redes/pendientes', autenticarToken, isSuperAdmin, listarRedesPendientesAprobacion)
router.patch('/superadmin/redes/:redId/aprobacion', autenticarToken, isSuperAdmin, resolverAprobacionRed)
router.patch('/superadmin/redes/:redId/revocar-admin', autenticarToken, isSuperAdmin, revocarAdminRed)
router.patch('/superadmin/redes/:redId/asignar-dueno', autenticarToken, isSuperAdmin, asignarDuenoRed)
router.delete('/superadmin/publicaciones/:id', autenticarToken, isSuperAdmin, eliminarPublicacionSuperAdmin)

export default router
