import { Schema, model } from 'mongoose'

// Modelo de relación AdminRed: representa permisos de un Estudiante sobre una RedComunitaria
const adminRedRelationSchema = new Schema({
    usuarioId: {
        type: Schema.Types.ObjectId,
        ref: 'Estudiante',
        required: true
    },
    redId: {
        type: Schema.Types.ObjectId,
        ref: 'RedComunitaria',
        required: true
    },
    estado: {
        type: String,
        enum: ['pendiente', 'activo', 'revocado'],
        default: 'pendiente'
    },
    permisos: {
        type: [String],
        default: ['gestion_publicaciones', 'gestionar_miembros']
    },
    fechaSolicitud: {
        type: Date,
        default: Date.now
    },
    fechaAprobacion: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
})

export default model('AdminRed', adminRedRelationSchema, 'adminRedes')
