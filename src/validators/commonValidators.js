import { body, param } from 'express-validator'

// Generic sanitizers / tiny helpers
const trimAndNotEmpty = (field, { optional = false, location = 'body' } = {}) => {
  const chain = location === 'param' ? param(field) : body(field)
  return (optional ? chain.optional() : chain.exists().withMessage(`${field} es obligatorio`))
    .bail()
    .isString().withMessage(`${field} debe ser un texto`)
    .bail()
    .trim()
    .notEmpty().withMessage(`${field} no puede estar vacío`)
}

const normalizeEmail = (field = 'email', { optional = false } = {}) => {
  const chain = body(field)
  return (optional ? chain.optional() : chain.exists().withMessage('El email es obligatorio'))
    .bail()
    .isString().withMessage('El email debe ser un texto')
    .bail()
    .trim()
    .normalizeEmail()
    .toLowerCase()
    .isEmail().withMessage('El email no tiene un formato válido')
}

const passwordField = (field = 'password', { optional = false, min = 8 } = {}) => {
  const chain = body(field)
  return (optional ? chain.optional() : chain.exists().withMessage('La contraseña es obligatoria'))
    .bail()
    .isString().withMessage('La contraseña debe ser un String (texto)')
    .bail()
    .trim()
    .notEmpty().withMessage('La contraseña no puede estar vacía')
    .bail()
    .isLength({ min }).withMessage(`La contraseña debe tener al menos ${min} caracteres`)
}

// Validator removed: related contact-number field is not used in the model.

const booleanBody = (field = 'verificada', { optional = false } = {}) => {
  const chain = body(field)
  return (optional ? chain.optional() : chain.exists().withMessage(`${field} es obligatorio`))
    .bail()
    .isBoolean().withMessage(`${field} debe ser booleano`)
}

const numberField = (field = 'number', { optional = false, min, max, integer = false } = {}) => {
  const chain = body(field)
  const base = (optional ? chain.optional() : chain.exists().withMessage(`${field} es obligatorio`)).bail()
  if (integer) {
    return base.isInt({ ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) }).withMessage(`${field} debe ser un número entero${min !== undefined ? ' >= '+min : ''}${max !== undefined ? ' <= '+max : ''}`)
  }
  return base.isFloat({ ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) }).withMessage(`${field} debe ser un número válido${min !== undefined ? ' >= '+min : ''}${max !== undefined ? ' <= '+max : ''}`)
}

export { trimAndNotEmpty, normalizeEmail, passwordField, booleanBody, numberField }

