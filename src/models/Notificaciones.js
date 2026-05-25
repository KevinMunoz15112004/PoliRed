import mongoose from 'mongoose'

const notificacionSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante',
    required: true,
    index: true
  },
  emisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante',
    default: null
  },
  emisores: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante'
  }],
  totalEmisores: {
    type: Number,
    default: 1
  },
  emisorSnap: {
    nombre: String,
    apellido: String,
    username: String,
    fotoPerfil: String
  },
  tipo: {
    type: String,
    enum: ['like', 'comentario', 'respuesta_comentario', 'mensaje'],
    required: true
  },
  publicacionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Publicacion',
    default: null
  },
  comentarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comentario',
    default: null
  },
  conversacionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversacion',
    default: null
  },
  mensaje: {
    type: String,
    default: null,
    trim: true
  },
  leida: {
    type: Boolean,
    default: false
  }
}, { timestamps: true })

export default mongoose.model('Notificacion', notificacionSchema, 'notificaciones')