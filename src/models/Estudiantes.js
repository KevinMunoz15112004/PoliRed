import { Schema, model } from 'mongoose'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'

const estudianteSchema = new Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  apellido: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    minlength: 3,
    maxlength: 20,
    match: [/^[A-Za-z0-9._-]+$/, 'Username inválido. Sólo letras, números, puntos, guiones bajos y guiones.']
  },
  fotoPerfil: {
    type: String,
    default: null
  },
  perfilCompleto: {
    type: Boolean,
    default: false
  },
  biografia: {
    type: String,
    trim: true,
    maxlength: 150,
    default: null
  },
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  roles: {
    type: [String],
    enum: ['estudiante', 'admin_red'],
    default: ['estudiante']
  },
  password: {
    type: String,
    required: true
  },
  status: {
    type: Boolean,
    default: true
  },
  suspendido: {
    type: Boolean,
    default: false
  },
  token: {
    type: String,
    default: null
  },
  confirmEmail: {
    type: Boolean,
    default: false
  },
  
  redComunitaria: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RedComunitaria',
    default: []
  }],
  publicacionesGuardadas: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Publicacion',
    default: []
  }],
  
}, {
  timestamps: true
});


// Método para cifrar la contraseña del estudiante
estudianteSchema.methods.encrypPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Método para verificar la contraseña ingresada
estudianteSchema.methods.matchPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Método para crear un token
estudianteSchema.methods.crearToken = function () {
  const tokenGenerado = this.token = Math.random().toString(36).slice(2);
  return tokenGenerado;
};

// Agregar/Remover roles
estudianteSchema.methods.addRole = async function (role) {
  if (!this.roles.includes(role)) {
    this.roles.push(role)
    await this.save()
  }
}

estudianteSchema.methods.removeRole = async function (role) {
  if (this.roles.includes(role)) {
    this.roles = this.roles.filter(r => r !== role)
    await this.save()
  }
}

export default model('Estudiante', estudianteSchema, 'estudiantes');
