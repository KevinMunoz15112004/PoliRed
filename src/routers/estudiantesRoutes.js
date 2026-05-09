import {Router} from 'express'
import { registroEstudiante, confirmarMailEstudiante, comprobarTokenPasswordEstudiante, recuperarPasswordEstudiante, crearNuevoPasswordEstudiante, perfilEstudiante, actualizarUsername, completarPerfil, actualizarPerfilEstudiante, actualizarPasswordEstudiante, crearPublicacion, unirseARedComunitaria, listarPublicaciones, listarRedesDelEstudiante, listarPublicacionesPorRed, obtenerRedesComunitarias, obtenerRedesExplorar, publicarArticulo, listarArticulosPorRed, eliminarArticulo, actualizarArticulo, actualizarPublicacion, eliminarPublicacion, comprarArticulo, listarTodosArticulos, obtenerEstudiantes } 
from '../controllers/estudiantesController.js'
import { requirePerfilCompleto } from '../middlewares/checkPerfilCompleto.js'
import { verifyToken } from '../middlewares/auth.js'

const router = Router()

//Rutas para la gestión de la cuenta
router.post('/registro-estudiantes', registroEstudiante)
router.get('/confirmar/:token', confirmarMailEstudiante)
router.post('/recuperar-password-e', recuperarPasswordEstudiante)
router.get('/recuperar-password-e/:token', comprobarTokenPasswordEstudiante)
router.post('/nuevo-password-e/:token', crearNuevoPasswordEstudiante)
router.get('/perfil-estudiante', verifyToken, perfilEstudiante)
router.put('/perfil/username', verifyToken, actualizarUsername)
router.put('/completar/perfil', verifyToken, completarPerfil)
router.put('/estudiante/:id', verifyToken, actualizarPerfilEstudiante)
router.put('/estudiante/actualizarpassword/:id', verifyToken, actualizarPasswordEstudiante)

//Rutas para la gestión de publicaciones
router.post('/estudiantes/publicaciones', verifyToken, requirePerfilCompleto, crearPublicacion)
router.get('/publicaciones/listar', verifyToken, listarPublicaciones)
router.put('/publicaciones/actualizar/:id', verifyToken, actualizarPublicacion)
router.delete('/publicaciones/eliminar/:id', verifyToken, eliminarPublicacion)
router.get('/publicaciones/red/:redId', verifyToken, listarPublicacionesPorRed)
router.post('/publicaciones/articulos', verifyToken, requirePerfilCompleto, publicarArticulo)
router.get('/publicaciones/articulos/listar', verifyToken, listarTodosArticulos)
router.get('/publicaciones/articulos/listar/:redId', verifyToken, listarArticulosPorRed)
router.put('/publicaciones/articulo/actualizar/:id', verifyToken, actualizarArticulo)
router.delete('/publicaciones/articulo/eliminar/:id', verifyToken, eliminarArticulo)
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