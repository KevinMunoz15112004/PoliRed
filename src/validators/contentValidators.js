import { body } from 'express-validator'
import mongoose from 'mongoose'

const crearPublicacionValidator = [
  body('feedContext')
    .exists().withMessage('Campo feedContext obligatorio')
    .bail()
    .isString().withMessage('feedContext debe ser texto')
    .bail()
    .trim()
    .isIn(['home', 'global']).withMessage('feedContext inválido. Valores permitidos: home, global'),
  body('categoria')
    .exists().withMessage('Campo categoría obligatorio')
    .bail()
    .isString().withMessage('Categoría debe ser texto')
    .bail()
    .trim()
    .notEmpty().withMessage('Categoría no puede estar vacía'),
  body('comunidadId')
    .optional()
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) throw new Error('comunidadId no es un ObjectId válido')
      return true
    }),
  body('tipoContenido')
    .exists().withMessage('tipoContenido es obligatorio').bail()
    .isIn(['texto', 'imagen']).withMessage('tipoContenido inválido. Valores permitidos: texto, imagen'),
  // Conditional checks depending on tipoContenido
  // Cross-field validation: feedContext determines allowed categories and required comunidadId
  body()
    .custom((_, { req }) => {
      const feedContext = req.body.feedContext ? String(req.body.feedContext).trim().toLowerCase() : ''
      const categoria = req.body.categoria ? String(req.body.categoria).trim().toLowerCase() : ''

      if (feedContext === 'home') {
        if (categoria !== 'comunidad') throw new Error('feedContext "home" requiere categoría "comunidad"')
        if (!req.body.comunidadId) throw new Error('feedContext "home" requiere el id de una red comunitaria (comunidadId)')
        if (!mongoose.Types.ObjectId.isValid(req.body.comunidadId)) throw new Error('comunidadId no es un ObjectId válido')
      } else if (feedContext === 'global') {
        if (categoria !== 'noticias') throw new Error('feedContext "global" en publicaciones normales requiere categoría "noticias"')
      }

      // Tipo de contenido specific checks
      const tipo = req.body.tipoContenido ? String(req.body.tipoContenido).trim().toLowerCase() : 'texto'
      if (tipo === 'texto') {
        if (!req.body.titulo || !String(req.body.titulo).trim()) throw new Error('Título requerido para publicaciones de texto')
        if (!req.body.contenido || !String(req.body.contenido).trim()) throw new Error('Contenido requerido para publicaciones de texto')
        if ((req.body && req.body.mediaUrls) || (req.files && req.files.imagen)) throw new Error('No se permite media en publicaciones de tipo texto')
      } else {
        if (!req.body.contenido || !String(req.body.contenido).trim()) throw new Error('Contenido requerido para publicaciones con imagen')
        const hasFiles = req.files && req.files.imagen
        const media = req.body.mediaUrls
        const hasMediaUrls = media && ((Array.isArray(media) && media.length > 0) || (typeof media === 'string' && String(media).trim() !== ''))
        if (!hasFiles && !hasMediaUrls) throw new Error('Debes enviar al menos una imagen para publicaciones de tipo imagen')
      }

      return true
    })
]

const publicarArticuloValidator = [
  body('feedContext')
    .exists().withMessage('Campo feedContext obligatorio para artículos')
    .bail()
    .isString().withMessage('feedContext debe ser texto')
    .bail()
    .trim()
    .isIn(['global']).withMessage('Los artículos solo pueden publicarse en la red global, feedContext "global"'),
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
    .custom((value, { req }) => {
      const cat = req.body.categoria ? String(req.body.categoria).trim().toLowerCase() : ''
      // If category is 'venta' => price must be numeric > 0 (no 'gratis')
      if (cat === 'venta') {
        if (typeof value === 'string' && value.trim().toLowerCase() === 'gratis') {
          throw new Error('Para la categoría "venta" no se permite el valor "gratis"')
        }
        const parsed = Number(value)
        if (Number.isNaN(parsed) || parsed <= 0) throw new Error('Precio inválido para venta. Debe ser un número mayor que 0')
        return true
      }
      // If category is 'cursos' => allow 'gratis' or numeric >= 0
      if (cat === 'cursos') {
        if (typeof value === 'string' && value.trim().toLowerCase() === 'gratis') return true
        const parsed = Number(value)
        if (Number.isNaN(parsed) || parsed < 0) throw new Error('Precio inválido para cursos')
        return true
      }
      // fallback: validate numeric
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
    .exists().withMessage('tipoContenido es obligatorio').bail()
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
        const hasFiles = req.files && req.files.imagen
        const media = req.body.mediaUrls
        const hasMediaUrls = media && ((Array.isArray(media) && media.length > 0) || (typeof media === 'string' && String(media).trim() !== ''))
        if (!hasFiles && !hasMediaUrls) throw new Error('Debes enviar al menos una imagen para articulos de tipo imagen')
      }
      return true
    })
]

export { crearPublicacionValidator, publicarArticuloValidator }
