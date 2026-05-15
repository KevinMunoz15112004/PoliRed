import mongoose from "mongoose";

const TIPOS_CONTENIDO = ['texto', 'imagen', 'video'];
// Normal publications categories (internal lowercase)
const CATEGORIAS_PUBLICACION = ['comunidad', 'noticias', 'cursos'];

const comentarioSchema = new mongoose.Schema({
  autorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante',
    required: true
  },
  contenido: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const publicacionSchema = new mongoose.Schema({
  autorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante',
    required: true
  },
  comunidadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RedComunitaria',
    required: true
  },
  titulo: {
    type: String,
    required: true
  },
  contenido: {
    type: String,
    required: true
  },
  tipoContenido: {
    type: String,
    enum: TIPOS_CONTENIDO,
    default: 'texto'
  },
  categoria: {
    type: String,
    enum: CATEGORIAS_PUBLICACION,
    required: true
  },
  mediaUrl: {
    type: String,
    default: null,
    trim: true
  },
  comentarios: [comentarioSchema],
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
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Publicacion = mongoose.model("Publicacion", publicacionSchema);

export default Publicacion;