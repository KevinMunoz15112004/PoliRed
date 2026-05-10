import { body } from 'express-validator'
import { mongoIdBody } from './mongoValidators.js'

const PUBLICACION_TIPOS = [
  'Contenido Inapropiado',
  'Spam',
  'Acoso o Bullying',
  'Información falsa',
  'Otro'
]

const APP_TIPOS = [
  'Error Técnico',
  'Problema con la cuenta',
  'Contenidos Inapropiados',
  'Otro'
]

const USUARIO_TIPOS = [
  'Comportamiento inapropiado',
  'Acoso',
  'Otro'
]

// Reporte sobre una publicación dentro de una red comunitaria
const reportPublicacionValidator = [
  mongoIdBody('publicacionId'),
  body('tipo').exists().withMessage('El tipo es obligatorio').bail().isString().withMessage('Tipo inválido').bail().isIn(PUBLICACION_TIPOS).withMessage('Tipo no permitido'),
  // descripcion required only when tipo === 'Otro'
  body('descripcion').if(body('tipo').equals('Otro')).exists().withMessage('Descripcion obligatoria para "Otro"').bail().isString().withMessage('La descripcion debe ser texto').bail().trim().notEmpty().withMessage('La descripcion no puede estar vacía')
]

// Reporte general de la aplicación (va al superadmin)
const reportAppValidator = [
  body('tipo').exists().withMessage('El tipo es obligatorio').bail().isString().withMessage('Tipo inválido').bail().isIn(APP_TIPOS).withMessage('Tipo no permitido'),
  body('descripcion').if(body('tipo').equals('Otro')).exists().withMessage('Descripcion obligatoria para "Otro"').bail().isString().withMessage('La descripcion debe ser texto').bail().trim().notEmpty().withMessage('La descripcion no puede estar vacía')
]

// Reporte de usuario (va al superadmin)
const reportUsuarioValidator = [
  mongoIdBody('reportadoUsuarioId'),
  body('tipo').exists().withMessage('El tipo es obligatorio').bail().isString().withMessage('Tipo inválido').bail().isIn(USUARIO_TIPOS).withMessage('Tipo no permitido'),
  body('descripcion').if(body('tipo').equals('Otro')).exists().withMessage('Descripcion obligatoria para "Otro"').bail().isString().withMessage('La descripcion debe ser texto').bail().trim().notEmpty().withMessage('La descripcion no puede estar vacía')
]

export { reportPublicacionValidator, reportAppValidator, reportUsuarioValidator }
