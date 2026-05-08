import mongoose from 'mongoose'

const comentarioSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Publicacion',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante',
    required: true
  },
  contenido: {
    type: String,
    required: true,
    trim: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comentario',
    default: null,
    index: true
  },
  hijos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comentario',
    default: []
  }]
}, { timestamps: true })

comentarioSchema.index({ postId: 1, parentId: 1, createdAt: -1 })

export default mongoose.model('Comentario', comentarioSchema, 'comentarios')