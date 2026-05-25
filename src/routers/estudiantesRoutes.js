import {Router} from 'express'
import { registroEstudiante, confirmarMailEstudiante, comprobarTokenPasswordEstudiante, recuperarPasswordEstudiante, crearNuevoPasswordEstudiante, perfilEstudiante, actualizarUsername, completarPerfil, actualizarPerfilEstudiante, actualizarPasswordEstudiante, crearPublicacion, unirseARedComunitaria, salirseDeRedComunitaria, listarRedesDelEstudiante, listarPublicacionesPorRed, listarPublicacionesGlobal, listarPublicacionesComunidades, obtenerRedesComunitarias, obtenerPerfilRed, publicarArticulo, listarArticulosPorRed, listarArticulosGlobal, listarArticulosComunidades, eliminarArticulo, eliminarPublicacion, obtenerEstudiantes, obtenerPerfilPublicoInfo, obtenerPerfilPublicoFeed } 
from '../controllers/estudiantesController.js'
import { requirePerfilCompleto, disallowPerfilCompleto } from '../middlewares/checkPerfilCompleto.js'
import { verifyToken, optionalVerifyToken } from '../middlewares/auth.js'
import validators from '../validators/index.js'
import validateResult from '../validators/validateResult.js'
import { crearSolicitudHabilitarUsuario, crearReporteRed } from '../controllers/reportesSolicitudesController.js'

const router = Router()

//Rutas para la gestión de la cuenta
router.post('/registro-estudiantes', validators.name('nombre'), validators.name('apellido'), validators.normalizeEmail('email'), validators.passwordField('password'), validateResult, registroEstudiante)
router.get('/confirmar/:token', validators.tokenParam('token'), validateResult, confirmarMailEstudiante)
router.post('/recuperar-password-e', validators.normalizeEmail('email'), validateResult, recuperarPasswordEstudiante)
router.get('/recuperar-password-e/:token', validators.tokenParam('token'), validateResult, comprobarTokenPasswordEstudiante)
router.post('/nuevo-password-e/:token', validators.crearNuevoPasswordValidator, validateResult, crearNuevoPasswordEstudiante)
router.get('/perfil-estudiante', verifyToken, perfilEstudiante)
router.patch('/perfil/username', verifyToken, actualizarUsername)
router.patch('/completar/perfil', verifyToken, disallowPerfilCompleto, completarPerfil)
router.patch('/estudiante/:id', verifyToken, validators.mongoIdParam('id'), validators.actualizarPerfilValidator, validateResult, actualizarPerfilEstudiante)
router.patch('/estudiante/actualizarpassword/:id', verifyToken, validators.mongoIdParam('id'), validators.actualizarPasswordValidator, validateResult, actualizarPasswordEstudiante)

//Rutas para la gestión de publicaciones
router.post('/estudiantes/publicaciones', verifyToken, requirePerfilCompleto, validators.crearPublicacionValidator, validateResult, crearPublicacion)
router.delete('/publicaciones/eliminar/:id', verifyToken, validators.mongoIdParam('id'), validateResult, eliminarPublicacion)
router.get('/publicaciones/red/:redId', verifyToken, validators.mongoIdParam('redId'), validateResult, listarPublicacionesPorRed)
router.post('/publicaciones/articulos', verifyToken, requirePerfilCompleto, validators.publicarArticuloValidator, validateResult, publicarArticulo)
router.get('/publicaciones/articulos/listar/:redId', verifyToken, validators.mongoIdParam('redId'), validateResult, listarArticulosPorRed)
router.get('/publicaciones/articulos/global', verifyToken, listarArticulosGlobal)
router.get('/publicaciones/articulos/comunitarias', verifyToken, listarArticulosComunidades)
router.delete('/publicaciones/articulo/eliminar/:id', verifyToken, validators.mongoIdParam('id'), validateResult, eliminarArticulo)

//Rutas para la getsión de redes comunitarias
router.get('/redes/listar', verifyToken, obtenerRedesComunitarias)

// Obtener perfil de red
router.get('/redes/:redId', verifyToken, validators.mongoIdParam('redId'), validateResult, obtenerPerfilRed)

// Ver publicaciones de redes global y comunitarias
router.get('/publicaciones/global', verifyToken, listarPublicacionesGlobal)
router.get('/publicaciones/comunitarias', verifyToken, listarPublicacionesComunidades)

router.get('/estudiantes/listar/redes', verifyToken, listarRedesDelEstudiante)
router.post('/estudiantes/unirse/red', verifyToken, validators.mongoIdBody('redId'), validateResult, unirseARedComunitaria)
router.post('/estudiantes/salirse/red', verifyToken, validators.mongoIdBody('redId'), validateResult, salirseDeRedComunitaria)

//Rutas para la gestión de mensajes
router.get('/cargar/estudiantes', verifyToken, obtenerEstudiantes)
router.get('/perfil-publico/:usuarioId/info', verifyToken, validators.mongoIdParam('usuarioId'), validateResult, obtenerPerfilPublicoInfo)
router.get('/perfil-publico/:usuarioId/feed', verifyToken, validators.mongoIdParam('usuarioId'), validateResult, obtenerPerfilPublicoFeed)

// Solicitud para que un estudiante suspendido pida ser habilitado
// This route accepts requests with or without a token; when unauthenticated must provide email or username.
router.post('/estudiantes/solicitud-habilitar', optionalVerifyToken, validators.rehabilitarUsuarioValidator, validateResult, crearSolicitudHabilitarUsuario)

// Estudiante: reportes sobre redes
router.post('/estudiantes/reportes/red', verifyToken, validators.mongoIdBody('redId'), validateResult, crearReporteRed)


export default router