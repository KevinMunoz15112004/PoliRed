import {Router} from 'express'
import { comprobarTokenPassword, crearNuevoPassword, recuperarPassword, login, perfil, actualizarPerfil, actualizarAvatar, actualizarPassword, obtenerEstudiantes, obtenerEstudiantePorId, actualizarEstudiante, eliminarEstudiante, suspenderEstudiante, habilitarEstudiante, obtenerRedes, obtenerRedPorId, actualizarRed, eliminarRed, marcarRedVerificada } 
from '../controllers/SuperAdminController.js'
import validators from '../validators/index.js'
import validateResult from '../validators/validateResult.js'
import { listarReportesUsuarios, listarReportesApp, resolverReporteUsuario, resolverReporteApp, listarSolicitudesVerificacion, resolverSolicitudVerificacion, listarSolicitudesRehabilitar, resolverSolicitudRehabilitar } from '../controllers/reportesController.js'
import { autenticarToken, isSuperAdmin } from '../middlewares/authSuperAdmin.js'
import { verificarEstadoLogin } from '../middlewares/verificarLogin.js'
import { listarSolicitudesHabilitarUsuarios, resolverSolicitudHabilitarUsuario } from '../controllers/reportesController.js'

const router = Router()

//Rutas para la gestión de la cuenta
router.post('/recuperar-password', validators.recuperarPasswordValidator, validateResult, recuperarPassword)
router.get('/recuperar-password/:token', validators.tokenParam('token'), validateResult, comprobarTokenPassword)
router.post('/nuevo-password/:token', validators.crearNuevoPasswordValidator, validateResult, crearNuevoPassword)
router.post('/login', verificarEstadoLogin, validators.loginValidator, validateResult, login)
router.get('/perfil-superadmin', autenticarToken, isSuperAdmin, perfil)
router.patch('/actualizar-superadmin/', autenticarToken, isSuperAdmin,
	validators.actualizarPerfilValidator,
	validators.phone('celular', { optional: true }),
	validateResult,
	actualizarPerfil)
router.patch('/perfil/avatar', autenticarToken, isSuperAdmin, actualizarAvatar)
router.patch('/superadmin/actualizar-password/', autenticarToken, isSuperAdmin, validators.actualizarPasswordValidator, validateResult, actualizarPassword)

//Rutas para la gestión de usuarios
router.get('/estudiantes', autenticarToken, isSuperAdmin, obtenerEstudiantes)
router.get('/estudiantes/:id', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, obtenerEstudiantePorId)
router.patch('/actualizar-estudiantes/:id', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, actualizarEstudiante)
router.delete('/eliminar-estudiantes/:id', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, eliminarEstudiante)
router.patch('/estudiantes/:id/suspender', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, suspenderEstudiante)
router.patch('/estudiantes/:id/habilitar', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, habilitarEstudiante)

//Rutas para la gestión de redes comunitarias
router.get('/redes', autenticarToken, isSuperAdmin, obtenerRedes)
router.get('/red/:id', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, obtenerRedPorId)
router.patch('/actualizar-red/:id', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validators.title('nombre', { optional: true }), validators.description('descripcion', { optional: true }), validators.booleanBody('deshabilitada', { optional: true }), validateResult, actualizarRed)
router.delete('/eliminar-red/:id', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, eliminarRed)
// Marcar red como verificada (SuperAdmin)
router.patch('/red/:id/verificada', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validators.booleanBody('verificada', { optional: true }), validateResult, marcarRedVerificada)

// Reportes desde la app
router.get('/reportes/usuarios', autenticarToken, isSuperAdmin, listarReportesUsuarios)
router.get('/reportes/app', autenticarToken, isSuperAdmin, listarReportesApp)
router.patch('/reportes/usuarios/:id/resolver', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, resolverReporteUsuario)
router.patch('/reportes/app/:id/resolver', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, resolverReporteApp)

// Solicitudes de verificación/oficialización de redes
router.get('/redes/solicitudes', autenticarToken, isSuperAdmin, listarSolicitudesVerificacion)
router.patch('/redes/solicitudes/:id/resolver', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, resolverSolicitudVerificacion)

// Solicitudes de habilitar usuarios (creadas por estudiantes suspendidos)
router.get('/superadmin/solicitudes/habilitar-usuarios', autenticarToken, isSuperAdmin, listarSolicitudesHabilitarUsuarios)
router.patch('/superadmin/solicitudes/habilitar-usuarios/:id/resolver', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, resolverSolicitudHabilitarUsuario)

// Solicitudes de rehabilitar redes (creadas por admin_red)
router.get('/redes/rehabilitar/solicitudes', autenticarToken, isSuperAdmin, listarSolicitudesRehabilitar)
router.patch('/redes/rehabilitar/solicitudes/:id/resolver', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, resolverSolicitudRehabilitar)

export default router