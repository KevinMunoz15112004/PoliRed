import mongoose from 'mongoose'

const articuloSchema = new mongoose.Schema({
  titulo: String,
  descripcion: String,
  precio: Number,
  imagen: String,
  categoria: { type: String, enum: ['venta'], default: 'venta' },
  autorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudiante' },
  redComunitaria: { type: mongoose.Schema.Types.ObjectId, ref: 'RedComunitaria' },
  vendido: { type: Boolean, default: false }
}, { timestamps: true })

export const Articulo = mongoose.model('Articulo', articuloSchema, 'articulos')
