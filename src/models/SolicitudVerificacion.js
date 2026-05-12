import { Schema, model } from 'mongoose'

const solicitudVerificacionSchema = new Schema({
  redId: { type: Schema.Types.ObjectId, ref: 'RedComunitaria', required: true },
  solicitante: { type: Schema.Types.ObjectId, ref: 'Estudiante', required: true },
  descripcion: { type: String, trim: true, required: true },
  solicitarVerificada: { type: Boolean, default: false },
  solicitarOficial: { type: Boolean, default: false },
  estado: { type: String, enum: ['pendiente', 'aprobada', 'rechazada'], default: 'pendiente' },
  respuesta: { type: String, default: null }
}, { timestamps: true })

export default model('SolicitudVerificacion', solicitudVerificacionSchema, 'solicitudes_verificacion')
