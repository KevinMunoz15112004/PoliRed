import {Schema, model} from 'mongoose'
import bcrypt from "bcryptjs"

const superAdminSchema = new Schema({
    nombre:{
        type:String,
        required:true,
        trim:true
    },
    apellido:{
        type:String,
        required:true,
        trim:true
    },
    email:{
        type:String,
        required:true,
        trim:true,
	    unique:true
    },
    password:{
        type:String,
        required:true
    },
    status:{
        type:Boolean,
        default:true
    },
    token:{
        type:String,
        default:null
    },
    confirmEmail:{
        type:Boolean,
        default:false
    },
    avatar: {
        type: String,
        default: null,
        trim: true,
    }, 
    rol:{
        type:String,
        default:"SuperAdmin"
    }

}, {
    timestamps:true
})


// Normalizar email antes de guardar/actualizar (guardar en lowercase)
superAdminSchema.pre('save', function(next) {
    if (this.email && typeof this.email === 'string') {
        this.email = this.email.trim().toLowerCase()
    }
    next()
})

superAdminSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate()
    if (update && update.email && typeof update.email === 'string') {
        update.email = update.email.trim().toLowerCase()
        this.setUpdate(update)
    }
    next()
})


// Método para cifrar la contraseña del SuperAdmin
superAdminSchema.methods.encrypPassword = async function(password){
    const salt = await bcrypt.genSalt(10)
    const passwordEncryp = await bcrypt.hash(password,salt)
    return passwordEncryp
}


// Método para verificar si el password ingresado es el mismo de la BDD
superAdminSchema.methods.matchPassword = async function(password){
    const response = await bcrypt.compare(password,this.password)
    return response
}


// Método para crear un token 
superAdminSchema.methods.crearToken = function(){
    const tokenGenerado = this.token = Math.random().toString(36).slice(2)
    return tokenGenerado
}



export default model('SuperAdmin', superAdminSchema, 'superAdmin')