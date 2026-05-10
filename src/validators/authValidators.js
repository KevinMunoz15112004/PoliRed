import { normalizeEmail, passwordField, trimAndNotEmpty } from './commonValidators.js'
import { tokenParam, mongoIdParam } from './mongoValidators.js'
import { body } from 'express-validator'

const loginValidator = [
  normalizeEmail('email'),
  passwordField('password')
]

const recuperarPasswordValidator = [
  normalizeEmail('email')
]

const crearNuevoPasswordValidator = [
  passwordField('password'),
  body('confirmpassword')
    .exists().withMessage('Debes confirmar la contraseña')
    .bail()
    .isString().withMessage('La confirmación debe ser un String (texto)')
    .bail()
    .trim()
    .notEmpty().withMessage('La confirmación no puede estar vacía')
    .bail()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Las contraseñas no coinciden')
      }
      return true
    }),
  tokenParam('token')
]

const actualizarPasswordValidator = [
  trimAndNotEmpty('passwordactual'),
  passwordField('passwordnuevo')
]

const actualizarPerfilValidator = [
  // All optional, format-only
  trimAndNotEmpty('nombre', { optional: true }),
  trimAndNotEmpty('apellido', { optional: true }),
  trimAndNotEmpty('direccion', { optional: true }),
  // celular handled as phone in commonValidators
  // email normalized if provided
  normalizeEmail('email', { optional: true })
]

const mongoIdParamValidator = (field = 'id') => [mongoIdParam(field)]

export { loginValidator, recuperarPasswordValidator, crearNuevoPasswordValidator, actualizarPasswordValidator, actualizarPerfilValidator, mongoIdParamValidator }
