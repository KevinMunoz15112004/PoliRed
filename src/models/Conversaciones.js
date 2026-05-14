import mongoose from 'mongoose'

const conversacionSchema = new mongoose.Schema({
  participantes: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Estudiante'
    }],
    required: true,
    validate: [
      {
        validator: (arr) => Array.isArray(arr) && arr.length === 2,
        message: 'La conversación debe tener exactamente 2 participantes'
      },
      {
        validator: (arr) => {
          if (!Array.isArray(arr)) return false
          const uniq = new Set(arr.map(String))
          return uniq.size === 2
        },
        message: 'Los participantes deben ser distintos'
      }
    ]
  },
  vendedorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante',
    default: null
  },
  ultimoMensaje: {
    contenido: { type: String, default: null },
    autorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudiante', default: null },
    fecha: { type: Date, default: null }
  },
  ultimaActividad: {
    type: Date,
    default: null,
    index: true
  },
  // pairHash: deterministic identifier for a 1:1 conversation to avoid duplicates
  pairHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  }
}, { timestamps: true })

// Before validating, ensure exactly 2 participants and compute pairHash deterministically
conversacionSchema.pre('validate', function (next) {
  try {
    if (!Array.isArray(this.participantes) || this.participantes.length !== 2) {
      return next(new Error('La conversación debe tener exactamente 2 participantes'))
    }
    const ids = this.participantes.map(String).sort()
    this.pairHash = ids.join('_')
  } catch (e) {
    return next(e)
  }
  next()
})

conversacionSchema.index({ participantes: 1, updatedAt: -1 })

export default mongoose.model('Conversacion', conversacionSchema, 'conversaciones')