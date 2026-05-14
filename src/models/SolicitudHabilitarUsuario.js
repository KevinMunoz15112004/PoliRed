import { Schema, model } from 'mongoose'

const solicitudHabilitarSchema = new Schema({
  solicitante: { type: Schema.Types.ObjectId, ref: 'Estudiante', required: true },
  motivo: { type: String, trim: true, required: true },
  estado: { type: String, enum: ['pendiente', 'aprobada', 'rechazada'], default: 'pendiente' },
  respuesta: { type: String, default: null }
}, { timestamps: true })

export default model('SolicitudHabilitarUsuario', solicitudHabilitarSchema, 'solicitudes_habilitar_usuario')
