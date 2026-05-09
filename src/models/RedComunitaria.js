import mongoose from 'mongoose';

const redComunitariaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  descripcion: {
    type: String,
    required: true,
    trim: true
  },
  miembros: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante'
  }],
  creadaPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante',
    default: null
  },
  // Indica si la red es global (se asigna automáticamente a nuevos usuarios y
  // solo se muestra en la pestaña Explorar)
  esGlobal: {
    type: Boolean,
    default: false
  },
  // Marca la red como verificada por SuperAdmin (azul)
  esVerificada: {
    type: Boolean,
    default: false
  },
  fotoPerfil: {
    type: String,
    default: null
  },
  // Referencia al AdminRed que gestiona la red (cuenta web)
  // ownerAdmin se mantiene por compatibilidad (referencia antigua a AdminRed)
  // Nota: `creadaPor` es el único campo que indica quién creó/la administra la red.
  estadoAprobacion: {
    type: String,
    enum: ['pendiente', 'aprobada', 'rechazada'],
    default: 'pendiente'
  },
  esOficial: {
    type: Boolean,
    default: false
  },
  cantidadMiembros: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('RedComunitaria', redComunitariaSchema, 'redesComunitarias');
