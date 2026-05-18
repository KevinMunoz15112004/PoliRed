import mongoose from 'mongoose'

const articuloSchema = new mongoose.Schema({
  titulo: String,
  descripcion: String,
  tipoContenido: { type: String, enum: ['texto', 'imagen'], default: 'texto' },
  precio: { type: mongoose.Schema.Types.Mixed }, // number or string like 'Gratis'
  mediaUrls: {
    type: [String],
    default: []
  },
  categoria: { type: String, enum: ['venta', 'cursos'], default: 'venta' },
  autorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudiante' },
  redComunitaria: { type: mongoose.Schema.Types.ObjectId, ref: 'RedComunitaria' },
  vendido: { type: Boolean, default: false },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante'
  }],
  likesCount: {
    type: Number,
    default: 0
  },
  commentsCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true })

export const Articulo = mongoose.model('Articulo', articuloSchema, 'articulos')
