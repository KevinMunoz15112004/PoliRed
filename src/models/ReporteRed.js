import { Schema, model } from 'mongoose'

const reporteRedSchema = new Schema({
  tipo: { type: String, default: 'otro' },
  descripcion: { type: String, trim: true, default: '' },
  reporterId: { type: Schema.Types.ObjectId, ref: 'Estudiante', default: null },
  redId: { type: Schema.Types.ObjectId, ref: 'RedComunitaria', required: true },
  archivos: [{ type: String }],
  estado: { type: String, enum: ['pendiente', 'en_progreso', 'resuelto', 'rechazado'], default: 'pendiente' },
  respuesta: { type: String, default: null }
}, { timestamps: true })

export default model('ReporteRed', reporteRedSchema, 'reportes_red')
