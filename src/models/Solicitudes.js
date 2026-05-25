import { Schema, model } from 'mongoose'

const solicitudesSchema = new Schema({
  subtype: { type: String, required: true, enum: ['verificacion', 'rehabilitar_red', 'habilitar_usuario'] },
  solicitante: { type: Schema.Types.ObjectId, ref: 'Estudiante', required: true },
  descripcion: { type: String, trim: true, default: '' },
  estado: { type: String, enum: ['pendiente', 'aprobada', 'rechazada'], default: 'pendiente' },
  respuesta: { type: String, default: null },
  meta: {
    redId: { type: Schema.Types.ObjectId, ref: 'RedComunitaria', default: null },
    solicitarVerificada: { type: Boolean, default: false },
    solicitarOficial: { type: Boolean, default: false },
    motivo: { type: String, default: null }
  }
}, { timestamps: true })

solicitudesSchema.index({ subtype: 1, estado: 1 })
solicitudesSchema.index({ solicitante: 1 })
solicitudesSchema.index({ 'meta.redId': 1 })

export default model('SolicitudUnificada', solicitudesSchema, 'solicitudes')
