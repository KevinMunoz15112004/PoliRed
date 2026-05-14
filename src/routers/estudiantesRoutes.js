import {Router} from 'express'
import { registroEstudiante, confirmarMailEstudiante, comprobarTokenPasswordEstudiante, recuperarPasswordEstudiante, crearNuevoPasswordEstudiante, perfilEstudiante, actualizarUsername, completarPerfil, actualizarPerfilEstudiante, actualizarPasswordEstudiante, crearPublicacion, unirseARedComunitaria, salirseDeRedComunitaria, listarPublicaciones, listarRedesDelEstudiante, listarPublicacionesPorRed, listarPublicacionesGlobal, listarPublicacionesComunidades, obtenerRedesComunitarias, obtenerRedesExplorar, obtenerPerfilRed, publicarArticulo, listarArticulosPorRed, eliminarArticulo, actualizarArticulo, actualizarPublicacion, eliminarPublicacion, comprarArticulo, listarTodosArticulos, obtenerEstudiantes } 
from '../controllers/estudiantesController.js'
import { requirePerfilCompleto, disallowPerfilCompleto } from '../middlewares/checkPerfilCompleto.js'
import { verifyToken } from '../middlewares/auth.js'
import validators from '../validators/index.js'
import validateResult from '../validators/validateResult.js'
import { crearSolicitudHabilitarUsuario } from '../controllers/reportesController.js'

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
router.post('/estudiantes/publicaciones', verifyToken, requirePerfilCompleto, validators.title('titulo'), validators.trimAndNotEmpty('contenido'), validators.mongoIdBody('comunidadId', { optional: true }), validateResult, crearPublicacion)
router.get('/publicaciones/listar', verifyToken, listarPublicaciones)
router.patch('/publicaciones/actualizar/:id', verifyToken, validators.mongoIdParam('id'), validateResult, actualizarPublicacion)
router.delete('/publicaciones/eliminar/:id', verifyToken, validators.mongoIdParam('id'), validateResult, eliminarPublicacion)
router.get('/publicaciones/red/:redId', verifyToken, validators.mongoIdParam('redId'), validateResult, listarPublicacionesPorRed)
router.post('/publicaciones/articulos', verifyToken, requirePerfilCompleto, validators.title('titulo'), validators.description('descripcion'), validators.number('precio'), validators.mongoIdBody('comunidadId', { optional: true }), validateResult, publicarArticulo)
router.get('/publicaciones/articulos/listar', verifyToken, listarTodosArticulos)
router.get('/publicaciones/articulos/listar/:redId', verifyToken, validators.mongoIdParam('redId'), validateResult, listarArticulosPorRed)
router.patch('/publicaciones/articulo/actualizar/:id', verifyToken, validators.mongoIdParam('id'), validateResult, actualizarArticulo)
router.delete('/publicaciones/articulo/eliminar/:id', verifyToken, validators.mongoIdParam('id'), validateResult, eliminarArticulo)
router.post('/articulo/comprar', verifyToken, comprarArticulo)

//Rutas para la getsión de redes comunitarias
router.get('/redes/listar', verifyToken, obtenerRedesComunitarias)

// Obtener publicaciones solo de la red global
router.get('/redes/explorar', obtenerRedesExplorar)
router.get('/redes/:redId', verifyToken, validators.mongoIdParam('redId'), validateResult, obtenerPerfilRed)
router.get('/publicaciones/global', listarPublicacionesGlobal)
router.get('/publicaciones/comunitarias', listarPublicacionesComunidades)

router.get('/estudiantes/listar/redes', verifyToken, listarRedesDelEstudiante)
router.post('/estudiantes/unirse/red', verifyToken, validators.mongoIdBody('redId'), validateResult, unirseARedComunitaria)
router.post('/estudiantes/salirse/red', verifyToken, validators.mongoIdBody('redId'), validateResult, salirseDeRedComunitaria)

//Rutas para la gestión de mensajes
router.get('/cargar/estudiantes', verifyToken, obtenerEstudiantes)

// Solicitud para que un estudiante suspendido pida ser habilitado
router.post('/estudiantes/solicitud-habilitar', verifyToken, validators.rehabilitarUsuarioValidator, validateResult, crearSolicitudHabilitarUsuario)


export default router