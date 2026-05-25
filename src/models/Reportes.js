import { Schema, model } from 'mongoose'

const reportesSchema = new Schema({
  subtype: { type: String, required: true, enum: ['publicacion', 'usuario', 'red', 'app'] },
  tipo: { type: String, default: 'otro' },
  descripcion: { type: String, trim: true, default: '' },
  reporterId: { type: Schema.Types.ObjectId, ref: 'Estudiante', default: null },
  archivos: [{ type: String }],
  estado: { type: String, enum: ['pendiente', 'en_progreso', 'resuelto', 'rechazado'], default: 'pendiente' },
  respuesta: { type: String, default: null },
  meta: {
    publicacionId: { type: Schema.Types.ObjectId, ref: 'Publicacion', default: null },
    reportadoUsuarioId: { type: Schema.Types.ObjectId, ref: 'Estudiante', default: null },
    redId: { type: Schema.Types.ObjectId, ref: 'RedComunitaria', default: null }
  }
}, { timestamps: true })

reportesSchema.index({ subtype: 1, estado: 1 })
reportesSchema.index({ reporterId: 1 })
reportesSchema.index({ 'meta.redId': 1 })

export default model('ReporteUnificado', reportesSchema, 'reportes')
