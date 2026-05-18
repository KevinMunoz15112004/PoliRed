import { Schema, model } from 'mongoose';

const mensajeSchema = new Schema({
  conversacionId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversacion',
    required: true,
    index: true
  },
  autor: {
    type: Schema.Types.ObjectId,
    ref: 'Estudiante',
    required: true
  },
  destinatario: {
    type: Schema.Types.ObjectId,
    ref: 'Estudiante',
    required: true
  },
  contenido: {
    type: String,
    required: true,
    trim: true
  }
  ,
  // Indica si el destinatario ya leyó el mensaje
  leido: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

// Index to support most common query: fetch messages by conversacion sorted by createdAt desc
mensajeSchema.index({ conversacionId: 1, createdAt: -1 });
// Compound index to quickly count unread messages per conversation and destinatario
mensajeSchema.index({ conversacionId: 1, destinatario: 1, leido: 1 });

export default model('Mensaje', mensajeSchema, 'mensajes');
