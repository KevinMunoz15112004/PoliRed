import { Schema, model } from 'mongoose'

const reporteSchema = new Schema({
  tipo: {
    type: String,
    default: 'otro'
  },
  descripcion: {
    type: String,
    trim: true,
    default: ''
  },
  usuarioId: {
    type: Schema.Types.ObjectId,
    ref: 'Estudiante',
    default: null
  },
  // If reporting a publication within a community
  publicacionId: {
    type: Schema.Types.ObjectId,
    ref: 'Publicacion',
    default: null
  },
  // If reporting a user
  reportadoUsuarioId: {
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
