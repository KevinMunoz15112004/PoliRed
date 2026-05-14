import { Schema, model } from 'mongoose'

const reportePublicacionSchema = new Schema({
  tipo: { type: String, default: 'otro' },
  descripcion: { type: String, trim: true, default: '' },
  reporterId: { type: Schema.Types.ObjectId, ref: 'Estudiante', default: null },
  publicacionId: { type: Schema.Types.ObjectId, ref: 'Publicacion', required: true },
  redId: { type: Schema.Types.ObjectId, ref: 'RedComunitaria', default: null },
  archivos: [{ type: String }],
  estado: { type: String, enum: ['pendiente', 'en_progreso', 'resuelto', 'rechazado'], default: 'pendiente' },
  respuesta: { type: String, default: null }
}, { timestamps: true })

export default model('ReportePublicacion', reportePublicacionSchema, 'reportes_publicacion')
