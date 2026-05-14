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
}, {
  timestamps: true
});

// Index to support most common query: fetch messages by conversacion sorted by createdAt desc
mensajeSchema.index({ conversacionId: 1, createdAt: -1 });

export default model('Mensaje', mensajeSchema, 'mensajes');
