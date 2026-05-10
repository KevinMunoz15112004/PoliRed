import {Router} from 'express'
import { comprobarTokenPassword, crearNuevoPassword, recuperarPassword, login, perfil, actualizarPerfil, actualizarAvatar, actualizarPassword, obtenerEstudiantes, obtenerEstudiantePorId, actualizarEstudiante, eliminarEstudiante, crearRed, obtenerRedes, obtenerRedPorId, actualizarRed, eliminarRed, marcarRedVerificada } 
from '../controllers/SuperAdminController.js'
import validators from '../validators/index.js'
import validateResult from '../validators/validateResult.js'
import { listarReportesSuperAdmin, listarReportesApp, resolverReporte } from '../controllers/reportesController.js'
import { autenticarToken, isSuperAdmin } from '../middlewares/authSuperAdmin.js'
import { verificarEstadoLogin } from '../middlewares/verificarLogin.js'

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

//Rutas para la gestión de redes comunitarias
router.post('/crear-red', autenticarToken, isSuperAdmin, validators.title('nombre'), validators.description('descripcion', { optional: true }), validateResult, crearRed)
router.get('/redes', autenticarToken, isSuperAdmin, obtenerRedes)
router.get('/red/:id', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, obtenerRedPorId)
router.patch('/actualizar-red/:id', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validators.title('nombre', { optional: true }), validators.description('descripcion', { optional: true }), validateResult, actualizarRed)
router.delete('/eliminar-red/:id', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validateResult, eliminarRed)
// Marcar red como verificada (SuperAdmin)
router.patch('/red/:id/verificada', autenticarToken, isSuperAdmin, validators.mongoIdParam('id'), validators.booleanBody('verificada', { optional: true }), validateResult, marcarRedVerificada)

// Reportes desde la app
router.get('/reportes', autenticarToken, isSuperAdmin, listarReportesSuperAdmin)
router.get('/reportes/app', autenticarToken, isSuperAdmin, listarReportesApp)
router.patch('/reportes/:id/resolver', autenticarToken, isSuperAdmin, resolverReporte)

export default router