import { param, body } from 'express-validator'
import mongoose from 'mongoose'

const tokenParam = (field = 'token', { optional = false } = {}) => {
  const chain = param(field)
  return (optional ? chain.optional() : chain.exists().withMessage('El token es obligatorio'))
    .bail()
    .isString().withMessage('El token debe ser un String (texto)')
    .bail()
    .trim()
    .notEmpty().withMessage('El token no puede estar vacío')
}

const mongoIdParam = (field = 'id', { optional = false } = {}) => {
  const chain = param(field)
  return (optional ? chain.optional() : chain.exists().withMessage(`${field} es obligatorio`))
    .bail()
    .custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage(`${field} no es un ObjectId válido`)
}

const mongoIdBody = (field = 'id', { optional = false } = {}) => {
  const chain = body(field)
  return (optional ? chain.optional() : chain.exists().withMessage(`${field} es obligatorio`))
    .bail()
    .custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage(`${field} no es un ObjectId válido`)
}

export { tokenParam, mongoIdParam, mongoIdBody }
