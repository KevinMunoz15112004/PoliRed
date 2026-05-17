import { Router } from 'express'
import { verifyToken, requireRole } from '../middlewares/auth.js'
import { verificarEstadoLogin } from '../middlewares/verificarLogin.js'
import { actualizarAvatarAdminRed, perfilAdminRed, actualizarPerfilAdminRed, actualizarPasswordAdminRed, listarPublicaciones, listarArticulosPorRedAdmin, eliminarArticuloAdmin, eliminarPublicacionAdmin, verEstudiantesDeRed, eliminarEstudianteDeRed, actualizarRedComunitaria, obtenerInfoRed} from '../controllers/adminRedController.js'
import validators from '../validators/index.js'
import validateResult from '../validators/validateResult.js'
import { resolverReportePublicacionAdmin, crearSolicitudVerificacion, deleteReportePublicacionAdmin, listarMisSolicitudesRehabilitar, listarMisSolicitudesVerificacion } from '../controllers/reportesController.js'
import { crearSolicitudRehabilitar, deleteSolicitudRehabilitarByAdmin } from '../controllers/reportesController.js'

const router = Router()

//Rutas para la gestión de la cuenta (login moved to /api/auth/login)
router.patch('/perfil/avatar/admin-red', verifyToken, requireRole('admin_red'), actualizarAvatarAdminRed)
router.get('/perfil/admin-red', verifyToken, requireRole('admin_red'), perfilAdminRed)
router.patch('/perfil/admin-red/actualizar', verifyToken, requireRole('admin_red'), validators.actualizarPerfilValidator, validateResult, actualizarPerfilAdminRed)
router.patch('/perfil/admin-red/actualizar/password', verifyToken, requireRole('admin_red'), validators.actualizarPasswordValidator, validateResult, actualizarPasswordAdminRed)

//Rutas para la gestión de publicaciones
router.get('/publicaciones/listar/admin', verifyToken, requireRole('admin_red'), listarPublicaciones)
router.delete('/publicaciones/admin/eliminar/:id', verifyToken, requireRole('admin_red'), validators.mongoIdParam('id'), validateResult, eliminarPublicacionAdmin)
router.get('/publicaciones/articulos/listar/admin', verifyToken, requireRole('admin_red'), listarArticulosPorRedAdmin)
router.delete('/publicaciones/admin/articulo/eliminar/:id', verifyToken, requireRole('admin_red'), validators.mongoIdParam('id'), validateResult, eliminarArticuloAdmin)

//Rutas para la gestión de redes comunitarias
router.get('/red/admin/informacion', verifyToken, requireRole('admin_red'), obtenerInfoRed)
router.patch('/admin/actualizar/red', verifyToken, requireRole('admin_red'), validators.actualizarRedComunitariaValidator, validateResult, actualizarRedComunitaria)
router.get('/admin/estudiantes/listar', verifyToken, requireRole('admin_red'), verEstudiantesDeRed)
router.delete('/admin/estudiantes/eliminar/:estudianteId', verifyToken, requireRole('admin_red'), validators.mongoIdParam('estudianteId'), validateResult, eliminarEstudianteDeRed)

// Admin Red: resolver reportes de publicaciones de su red
router.patch('/reportes/:id/resolver', verifyToken, requireRole('admin_red'), validators.mongoIdParam('id'), validateResult, resolverReportePublicacionAdmin)
router.delete('/reportes/:id', verifyToken, requireRole('admin_red'), validators.mongoIdParam('id'), validateResult, deleteReportePublicacionAdmin)
router.delete('/solicitudes/rehabilitar/:id', verifyToken, requireRole('admin_red'), validators.mongoIdParam('id'), validateResult, deleteSolicitudRehabilitarByAdmin)
// Admin Red: listar sus propias solicitudes
router.get('/solicitudes/rehabilitar', verifyToken, requireRole('admin_red'), listarMisSolicitudesRehabilitar)
router.get('/solicitudes/verificacion', verifyToken, requireRole('admin_red'), listarMisSolicitudesVerificacion)

// Admin Red:crear solicitud para rehabilitar su red deshabilitada
router.post('/solicitudes/rehabilitar', verifyToken, requireRole('admin_red'), validators.mongoIdBody('redId'), validators.description('descripcion', { optional: false }), validateResult, crearSolicitudRehabilitar)

// Admin Red:solicitar verificación/oficialización de su red (solo su red asignada)
router.post('/redes/solicitar-verificacion', verifyToken, requireRole('admin_red'), validators.mongoIdBody('redId'), validators.trimAndNotEmpty('descripcion'), validateResult, crearSolicitudVerificacion)

export default router
