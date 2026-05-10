import { body } from 'express-validator'

const nameRegex = /^(?!.*([A-Za-zÁÉÍÓÚáéíóúÑñ])\1{2,})[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/

const nameValidator = (field = 'nombre', { optional = false } = {}) => {
  const chain = body(field)
  return (optional ? chain.optional() : chain.exists().withMessage(`${field} es obligatorio`))
    .bail()
    .isString().withMessage(`${field} debe ser un texto`)
    .bail()
    .trim()
    .notEmpty().withMessage(`${field} no puede estar vacío`)
    .bail()
    .matches(nameRegex).withMessage(`${field} no debe contener letras repetidas excesivamente, caracteres especiales ni números`)
}

const usernameValidator = (field = 'username', { optional = false, min = 3, max = 30 } = {}) => {
  const chain = body(field)
  return (optional ? chain.optional() : chain.exists().withMessage(`${field} es obligatorio`))
    .bail()
    .isString().withMessage(`${field} debe ser un texto`)
    .bail()
    .trim()
    .notEmpty().withMessage(`${field} no puede estar vacío`)
    .bail()
    .isLength({ min, max }).withMessage(`${field} debe tener entre ${min} y ${max} caracteres`)
    .bail()
    .matches(/^[A-Za-z0-9_\.\-]+$/).withMessage(`${field} solo puede contener letras, números, guiones bajos, puntos o guiones`)
}

const titleValidator = (field = 'nombre', { optional = false, min = 1, max = 200 } = {}) => {
  const chain = body(field)
  return (optional ? chain.optional() : chain.exists().withMessage(`${field} es obligatorio`))
    .bail()
    .isString().withMessage(`${field} debe ser un texto`)
    .bail()
    .trim()
    .notEmpty().withMessage(`${field} no puede estar vacío`)
    .bail()
    .isLength({ min, max }).withMessage(`${field} debe tener entre ${min} y ${max} caracteres`)
}

const descriptionValidator = (field = 'descripcion', { optional = false, min = 1, max = 2000 } = {}) => {
  const chain = body(field)
  return (optional ? chain.optional() : chain.exists().withMessage(`${field} es obligatorio`))
    .bail()
    .isString().withMessage(`${field} debe ser un texto`)
    .bail()
    .trim()
    .notEmpty().withMessage(`${field} no puede estar vacío`)
    .bail()
    .isLength({ min, max }).withMessage(`${field} debe tener entre ${min} y ${max} caracteres`)
}

export { nameValidator, usernameValidator, titleValidator, descriptionValidator }
