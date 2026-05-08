import { Schema, model } from 'mongoose'

const reporteSchema = new Schema({
  tipo: {
    type: String,
    enum: ['bug', 'red', 'otro'],
    default: 'otro'
  },
  descripcion: {
    type: String,
    required: true,
    trim: true
  },
  usuarioId: {
    type: Schema.Types.ObjectId,
    ref: 'Estudiante',
    default: null
  },
  redId: {
    type: Schema.Types.ObjectId,
    ref: 'RedComunitaria',
    default: null
  },
  archivos: [{ type: String }],
  estado: {
    type: String,
    enum: ['pendiente', 'en_progreso', 'resuelto'],
    default: 'pendiente'
  },
  respuesta: {
    type: String,
    default: null
  }
}, {
  timestamps: true
})

export default model('Reporte', reporteSchema, 'reportes')
