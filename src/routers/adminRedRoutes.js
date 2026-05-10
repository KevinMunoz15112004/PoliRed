import { Router } from 'express'
import { verifyToken, requireRole } from '../middlewares/auth.js'
import { verificarEstadoLogin } from '../middlewares/verificarLogin.js'
import { actualizarAvatarAdminRed, perfilAdminRed, actualizarPerfilAdminRed, actualizarPasswordAdminRed, listarPublicaciones, listarArticulosPorRedAdmin, eliminarArticuloAdmin, eliminarPublicacionAdmin, verEstudiantesDeRed, eliminarEstudianteDeRed, actualizarRedComunitaria, obtenerInfoRed} from '../controllers/adminRedController.js'
import validators from '../validators/index.js'
import validateResult from '../validators/validateResult.js'

const router = Router()

//Rutas para la gestión de la cuenta (login moved to /api/auth/login)
router.put('/perfil/avatar/admin-red', verifyToken, requireRole('admin_red'), actualizarAvatarAdminRed)
router.get('/perfil/admin-red', verifyToken, requireRole('admin_red'), perfilAdminRed)
router.put('/perfil/admin-red/actualizar', verifyToken, requireRole('admin_red'), validators.actualizarPerfilValidator, validateResult, actualizarPerfilAdminRed)
router.put('/perfil/admin-red/actualizar/password', verifyToken, requireRole('admin_red'), validators.actualizarPasswordValidator, validateResult, actualizarPasswordAdminRed)

//Rutas para la gestión de publicaciones
router.get('/publicaciones/listar/admin', verifyToken, requireRole('admin_red'), listarPublicaciones)
router.delete('/publicaciones/admin/eliminar/:id', verifyToken, requireRole('admin_red'), validators.mongoIdParam('id'), validateResult, eliminarPublicacionAdmin)
router.get('/publicaciones/articulos/listar/admin', verifyToken, requireRole('admin_red'), listarArticulosPorRedAdmin)
router.delete('/publicaciones/admin/articulo/eliminar/:id', verifyToken, requireRole('admin_red'), validators.mongoIdParam('id'), validateResult, eliminarArticuloAdmin)

//Rutas para la gestión de redes comunitarias
router.get('/red/admin/informacion', verifyToken, requireRole('admin_red'), obtenerInfoRed)
router.put('/admin/actualizar/red', verifyToken, requireRole('admin_red'), actualizarRedComunitaria)
router.get('/admin/estudiantes/listar', verifyToken, requireRole('admin_red'), verEstudiantesDeRed)
router.delete('/admin/estudiantes/eliminar/:estudianteId', verifyToken, requireRole('admin_red'), validators.mongoIdParam('estudianteId'), validateResult, eliminarEstudianteDeRed)

export default router
