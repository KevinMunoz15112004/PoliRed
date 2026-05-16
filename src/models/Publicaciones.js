import mongoose from "mongoose";

const TIPOS_CONTENIDO = ['texto', 'imagen'];
// Normal publications categories (internal lowercase)
const CATEGORIAS_PUBLICACION = ['comunidad', 'noticias'];


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
    default: null,
    trim: true
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
  // comentarios are stored in a separate `Comentario` collection; keep only the counter
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
}, { timestamps: true });

const Publicacion = mongoose.model("Publicacion", publicacionSchema);

export default Publicacion;