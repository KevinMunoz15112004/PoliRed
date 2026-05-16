import { body } from 'express-validator'

const actualizarRedComunitariaValidator = [
  // nombre and descripcion optional, but at least one of them or an uploaded file must be present
  body('nombre')
    .optional()
    .isString().withMessage('El nombre debe ser texto')
    .bail()
    .trim()
    .notEmpty().withMessage('El nombre no puede estar vacío'),
  body('descripcion')
    .optional()
    .isString().withMessage('La descripción debe ser texto')
    .bail()
    .trim()
    .notEmpty().withMessage('La descripción no puede estar vacía'),
  body()
    .custom((_, { req }) => {
      const hasNombre = req.body && req.body.nombre && String(req.body.nombre).trim() !== ''
      const hasDescripcion = req.body && req.body.descripcion && String(req.body.descripcion).trim() !== ''
      const hasFile = req.files && req.files.imagen
      if (!hasNombre && !hasDescripcion && !hasFile) {
        throw new Error('Debe proporcionar al menos un campo válido para actualizar (descripción o imagen).')
      }
      return true
    })
]

export { actualizarRedComunitariaValidator }
