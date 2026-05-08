import mongoose from 'mongoose'

const conversacionSchema = new mongoose.Schema({
  participantes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante',
    required: true
  }],
  vendedorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante',
    required: true
  },
  ultimoMensaje: {
    contenido: {
      type: String,
      default: null
    },
    autorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Estudiante',
      default: null
    },
    fecha: {
      type: Date,
      default: null
    }
  }
}, { timestamps: true })

conversacionSchema.index({ participantes: 1, updatedAt: -1 })

export default mongoose.model('Conversacion', conversacionSchema, 'conversaciones')