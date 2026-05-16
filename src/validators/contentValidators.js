import { body } from 'express-validator'
import mongoose from 'mongoose'

const crearPublicacionValidator = [
  body('categoria')
    .exists().withMessage('Campo categoría obligatorio')
    .bail()
    .isString().withMessage('Categoría debe ser texto')
    .bail()
    .trim()
    .notEmpty().withMessage('Categoría no puede estar vacía')
    .bail()
    .custom((value) => {
      const cat = String(value).trim().toLowerCase()
      const allowed = ['comunidad', 'noticias']
      if (!allowed.includes(cat)) throw new Error(`Categoría inválida. Valores permitidos: ${allowed.join(', ')}`)
      return true
    }),
  body('comunidadId')
    .optional()
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) throw new Error('comunidadId no es un ObjectId válido')
      return true
    }),
  body('tipoContenido')
    .optional()
    .isIn(['texto', 'imagen']).withMessage('tipoContenido inválido. Valores permitidos: texto, imagen'),
  // Conditional checks depending on tipoContenido
  body()
    .custom((_, { req }) => {
      const tipo = req.body.tipoContenido ? String(req.body.tipoContenido).trim().toLowerCase() : 'texto'
      if (tipo === 'texto') {
        if (!req.body.titulo || !String(req.body.titulo).trim()) throw new Error('Título requerido para publicaciones de texto')
        if (!req.body.contenido || !String(req.body.contenido).trim()) throw new Error('Contenido requerido para publicaciones de texto')
        if ((req.body && req.body.mediaUrls) || (req.files && req.files.imagen)) throw new Error('No se permite media en publicaciones de tipo texto')
      } else {
        if (!req.body.contenido || !String(req.body.contenido).trim()) throw new Error('Contenido requerido para publicaciones con imagen')
      }
      return true
    })
]

const publicarArticuloValidator = [
  body('categoria')
    .exists().withMessage('Campo categoría obligatorio')
    .bail()
    .isString().withMessage('Categoría debe ser texto')
    .bail()
    .trim()
    .notEmpty().withMessage('Categoría no puede estar vacía')
    .bail()
    .custom((value) => {
      const cat = String(value).trim().toLowerCase()
      const allowedArtCats = ['venta', 'cursos']
      if (!allowedArtCats.includes(cat)) throw new Error(`Categoría inválida para artículos. Valores permitidos: ${allowedArtCats.join(', ')}`)
      return true
    }),
  body('precio')
    .exists().withMessage('Campo precio obligatorio')
    .bail()
    .custom((value) => {
      if (typeof value === 'string' && value.trim().toLowerCase() === 'gratis') return true
      const parsed = Number(value)
      if (Number.isNaN(parsed) || parsed < 0) throw new Error('Precio inválido')
      return true
    }),
  body('comunidadId')
    .optional()
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) throw new Error('comunidadId no es un ObjectId válido')
      return true
    }),
  body('tipoContenido')
    .optional()
    .isIn(['texto', 'imagen']).withMessage('tipoContenido inválido. Valores permitidos: texto, imagen'),
  body()
    .custom((_, { req }) => {
      const tipo = req.body.tipoContenido ? String(req.body.tipoContenido).trim().toLowerCase() : 'texto'
      if (tipo === 'texto') {
        if (!req.body.titulo || !String(req.body.titulo).trim()) throw new Error('Título requerido para articulos de texto')
        if (!req.body.descripcion || !String(req.body.descripcion).trim()) throw new Error('Descripción requerida para articulos de texto')
        if ((req.body && req.body.mediaUrls) || (req.files && req.files.imagen)) throw new Error('No se permite media en articulos de tipo texto')
      } else {
        if (!req.body.descripcion || !String(req.body.descripcion).trim()) throw new Error('Descripción requerida para articulos con imagen')
      }
      return true
    })
]

export { crearPublicacionValidator, publicarArticuloValidator }
