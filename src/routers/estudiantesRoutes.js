import {Router} from 'express'
import { registroEstudiante, confirmarMailEstudiante, comprobarTokenPasswordEstudiante, recuperarPasswordEstudiante, crearNuevoPasswordEstudiante, perfilEstudiante, actualizarUsername, completarPerfil, actualizarPerfilEstudiante, actualizarPasswordEstudiante, crearPublicacion, unirseARedComunitaria, listarPublicaciones, listarRedesDelEstudiante, listarPublicacionesPorRed, obtenerRedesComunitarias, obtenerRedesExplorar, publicarArticulo, listarArticulosPorRed, eliminarArticulo, actualizarArticulo, actualizarPublicacion, eliminarPublicacion, comprarArticulo, listarTodosArticulos, obtenerEstudiantes } 
from '../controllers/estudiantesController.js'
import { requirePerfilCompleto } from '../middlewares/checkPerfilCompleto.js'
import { verifyToken } from '../middlewares/auth.js'
import validators from '../validators/index.js'
import validateResult from '../validators/validateResult.js'

const router = Router()

//Rutas para la gestión de la cuenta
router.post('/registro-estudiantes', validators.name('nombre'), validators.name('apellido'), validators.normalizeEmail('email'), validators.passwordField('password'), validateResult, registroEstudiante)
router.get('/confirmar/:token', validators.tokenParam('token'), validateResult, confirmarMailEstudiante)
router.post('/recuperar-password-e', validators.normalizeEmail('email'), validateResult, recuperarPasswordEstudiante)
router.get('/recuperar-password-e/:token', validators.tokenParam('token'), validateResult, comprobarTokenPasswordEstudiante)
router.post('/nuevo-password-e/:token', validators.crearNuevoPasswordValidator, validateResult, crearNuevoPasswordEstudiante)
router.get('/perfil-estudiante', verifyToken, perfilEstudiante)
router.put('/perfil/username', verifyToken, actualizarUsername)
router.put('/completar/perfil', verifyToken, completarPerfil)
router.put('/estudiante/:id', verifyToken, validators.mongoIdParam('id'), validators.actualizarPerfilValidator, validateResult, actualizarPerfilEstudiante)
router.put('/estudiante/actualizarpassword/:id', verifyToken, validators.mongoIdParam('id'), validators.actualizarPasswordValidator, validateResult, actualizarPasswordEstudiante)

//Rutas para la gestión de publicaciones
router.post('/estudiantes/publicaciones', verifyToken, requirePerfilCompleto, validators.title('titulo'), validators.trimAndNotEmpty('contenido'), validators.mongoIdBody('comunidadId', { optional: true }), validateResult, crearPublicacion)
router.get('/publicaciones/listar', verifyToken, listarPublicaciones)
router.put('/publicaciones/actualizar/:id', verifyToken, validators.mongoIdParam('id'), validateResult, actualizarPublicacion)
router.delete('/publicaciones/eliminar/:id', verifyToken, validators.mongoIdParam('id'), validateResult, eliminarPublicacion)
router.get('/publicaciones/red/:redId', verifyToken, validators.mongoIdParam('redId'), validateResult, listarPublicacionesPorRed)
router.post('/publicaciones/articulos', verifyToken, requirePerfilCompleto, validators.title('titulo'), validators.description('descripcion'), validators.number('precio'), validators.mongoIdBody('comunidadId', { optional: true }), validateResult, publicarArticulo)
router.get('/publicaciones/articulos/listar', verifyToken, listarTodosArticulos)
router.get('/publicaciones/articulos/listar/:redId', verifyToken, validators.mongoIdParam('redId'), validateResult, listarArticulosPorRed)
router.put('/publicaciones/articulo/actualizar/:id', verifyToken, validators.mongoIdParam('id'), validateResult, actualizarArticulo)
router.delete('/publicaciones/articulo/eliminar/:id', verifyToken, validators.mongoIdParam('id'), validateResult, eliminarArticulo)
router.post('/articulo/comprar', verifyToken, comprarArticulo)

//Rutas para la getsión de redes comunitarias
router.get('/redes/listar', verifyToken, obtenerRedesComunitarias)
//
router.get('/redes/explorar', obtenerRedesExplorar)
//
router.get('/estudiantes/listar/redes', verifyToken, listarRedesDelEstudiante)
router.post('/estudiantes/unirse/red', verifyToken, unirseARedComunitaria)

//Rutas para la gestión de mensajes
router.get('/cargar/estudiantes', verifyToken, obtenerEstudiantes)


export default router