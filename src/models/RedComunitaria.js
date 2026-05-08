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
  ownerAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminRed',
    default: null
  },
  // adminPrincipalId: referencia al usuario real (Estudiante) que actúa como admin principal
  adminPrincipalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante',
    default: null
  },
  dueno: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante',
    default: null
  },
  // Información mínima de la cuenta de gestión para consumo en frontend
  cuentaGestion: {
    nombre: { type: String, default: null },
    apellido: { type: String, default: null },
    email: { type: String, default: null },
    celular: { type: String, default: null },
    avatar: { type: String, default: null },
    rol: { type: String, default: 'Admin_Red' }
  },
  estadoAprobacion: {
    type: String,
    enum: ['pendiente', 'aprobada', 'rechazada'],
    default: 'pendiente'
  },
  esOficial: {
    type: Boolean,
    default: false
  },
  solicitudesUnion: [{
    estudianteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Estudiante',
      required: true
    },
    estado: {
      type: String,
      enum: ['pendiente', 'aprobada', 'rechazada'],
      default: 'pendiente'
    },
    fechaSolicitud: {
      type: Date,
      default: Date.now
    }
  }],
  cantidadMiembros: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('RedComunitaria', redComunitariaSchema, 'redesComunitarias');
