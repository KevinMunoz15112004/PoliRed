import { Schema, model } from 'mongoose'

const solicitudRehabilitarSchema = new Schema({
  redId: { type: Schema.Types.ObjectId, ref: 'RedComunitaria', required: true },
  solicitante: { type: Schema.Types.ObjectId, ref: 'Estudiante', required: true },
  descripcion: { type: String, trim: true, required: true },
  estado: { type: String, enum: ['pendiente', 'aprobada', 'rechazada'], default: 'pendiente' },
  respuesta: { type: String, default: null }
}, { timestamps: true })

export default model('SolicitudRehabilitarRed', solicitudRehabilitarSchema, 'solicitudes_rehabilitar_red')
