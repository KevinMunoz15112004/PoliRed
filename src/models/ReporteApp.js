import { Schema, model } from 'mongoose'

const reporteAppSchema = new Schema({
  tipo: { type: String, default: 'otro' },
  descripcion: { type: String, trim: true, default: '' },
  reporterId: { type: Schema.Types.ObjectId, ref: 'Estudiante', default: null },
  archivos: [{ type: String }],
  estado: { type: String, enum: ['pendiente', 'en_progreso', 'resuelto', 'rechazado'], default: 'pendiente' },
  respuesta: { type: String, default: null }
}, { timestamps: true })

export default model('ReporteApp', reporteAppSchema, 'reportes_app')
