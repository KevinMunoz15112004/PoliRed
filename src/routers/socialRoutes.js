import { Router } from 'express'
import { verifyToken, requireRole } from '../middlewares/auth.js'
import { autenticarToken, isSuperAdmin } from '../middlewares/authSuperAdmin.js'
import validators from '../validators/index.js'
import validateResult from '../validators/validateResult.js'
import {
  solicitarCreacionRed,
  darLikePublicacion,
  quitarLikePublicacion,
  crearComentarioPublicacion,
  responderComentario,
  listarComentariosArbol,
  guardarPublicacion,
  quitarGuardadoPublicacion,
  listarPublicacionesGuardadas,
  listarPublicacionesLiked,
  listarNotificaciones,
  marcarNotificacionLeida,
  listarRedesPendientesAprobacion,
  resolverAprobacionRed,
  revocarAdminRed,
  asignarDuenoRed,
  listarLikesPublicacion,
} from '../controllers/socialController.js'
import { requirePerfilCompleto } from '../middlewares/checkPerfilCompleto.js'
import { crearReportePublicacion, crearReporteApp, crearReporteUsuario, listarReportesAdminRed } from '../controllers/reportesController.js'

const router = Router()

//Estudiantes
router.post('/redes/solicitar-creacion', verifyToken, validators.title('nombre'), validators.description('descripcion'), validateResult, solicitarCreacionRed)

router.post('/publicaciones/:id/like', verifyToken, requirePerfilCompleto, validators.mongoIdParam('id'), validateResult, darLikePublicacion)
router.delete('/publicaciones/:id/like', verifyToken, requirePerfilCompleto, validators.mongoIdParam('id'), validateResult, quitarLikePublicacion)
router.get('/publicaciones/:id/likes', verifyToken, validators.mongoIdParam('id'), validateResult, listarLikesPublicacion)

router.post('/publicaciones/:id/comentarios', verifyToken, requirePerfilCompleto, validators.mongoIdParam('id'), validators.trimAndNotEmpty('contenido'), validateResult, crearComentarioPublicacion)
router.post('/comentarios/:comentarioId/responder', verifyToken, requirePerfilCompleto, validators.mongoIdParam('comentarioId'), validators.trimAndNotEmpty('contenido'), validateResult, responderComentario)
router.get('/publicaciones/:id/comentarios/arbol', verifyToken, validators.mongoIdParam('id'), validateResult, listarComentariosArbol)

router.post('/publicaciones/:id/guardar', verifyToken, requirePerfilCompleto, validators.mongoIdParam('id'), validateResult, guardarPublicacion)
router.delete('/publicaciones/:id/guardar', verifyToken, requirePerfilCompleto, validators.mongoIdParam('id'), validateResult, quitarGuardadoPublicacion)
router.get('/usuarios/guardados', verifyToken, listarPublicacionesGuardadas)
router.get('/usuarios/likes', verifyToken, listarPublicacionesLiked)

router.get('/notificaciones', verifyToken, listarNotificaciones)
router.patch('/notificaciones/:id/leida', verifyToken, validators.mongoIdParam('id'), validateResult, marcarNotificacionLeida)

// Reportes: estudiantes crean (publicación), admin de red consulta los reportes de su red
router.post('/reportes/publicacion', verifyToken, requirePerfilCompleto, validators.reportPublicacionValidator, validateResult, crearReportePublicacion)
router.get('/admin/reportes', verifyToken, requireRole('admin_red'), listarReportesAdminRed)

// Reportes generales de la app (van al superadmin)
router.post('/reportes/app', verifyToken, validators.reportAppValidator, validateResult, crearReporteApp)

// Reportes de usuarios (van al superadmin)
router.post('/reportes/usuario', verifyToken, validators.reportUsuarioValidator, validateResult, crearReporteUsuario)

// Superadmin
router.get('/superadmin/redes/pendientes', autenticarToken, isSuperAdmin, listarRedesPendientesAprobacion)
router.patch('/superadmin/redes/:redId/aprobacion', autenticarToken, isSuperAdmin, validators.mongoIdParam('redId'), validateResult, resolverAprobacionRed)
router.patch('/superadmin/redes/:redId/revocar-admin', autenticarToken, isSuperAdmin, validators.mongoIdParam('redId'), validators.mongoIdBody('usuarioId'), validateResult, revocarAdminRed)
router.patch('/superadmin/redes/:redId/asignar-dueno', autenticarToken, isSuperAdmin, validators.mongoIdParam('redId'), validators.mongoIdBody('usuarioId'), validateResult, asignarDuenoRed)

export default router
