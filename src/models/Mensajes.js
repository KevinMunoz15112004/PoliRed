import { Schema, model } from 'mongoose';

const mensajeSchema = new Schema({
  conversacionId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversacion',
    default: null,
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
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export default model('Mensaje', mensajeSchema, 'mensajes');
