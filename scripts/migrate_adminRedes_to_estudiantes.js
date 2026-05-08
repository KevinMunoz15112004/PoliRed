import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import AdminRed from '../src/models/adminRedes.js'
import Estudiante from '../src/models/Estudiantes.js'

async function migrate() {
  if (!process.env.MONGODB_URI_LOCAL) {
    console.error('Falta la variable de entorno MONGODB_URI_LOCAL')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI_LOCAL)
  console.log('Conectado a la DB')

  const admins = await AdminRed.find().lean()
  console.log(`Encontrados ${admins.length} administradores`) 

  for (const a of admins) {
    try {
      let estudiante = await Estudiante.findOne({ email: a.email })

      if (!estudiante) {
        // Crear estudiante mínimo usando password ya hasheado
        const nuevo = new Estudiante({
          nombre: a.nombre || 'Admin',
          apellido: a.apellido || 'Red',
          usuario: a.email.split('@')[0],
          email: a.email,
          password: a.password,
          confirmEmail: a.confirmEmail || false,
          roles: ['admin_red']
        })
        estudiante = await nuevo.save()
        console.log(`Creado Estudiante para ${a.email} -> ${estudiante._id}`)
      }

      // Actualizar admin para referenciar estudiante
      if (!a.estudianteId || a.estudianteId.toString() !== estudiante._id.toString()) {
        await AdminRed.updateOne({ _id: a._id }, { estudianteId: estudiante._id })
        console.log(`Admin ${a._id} actualizado con estudianteId ${estudiante._id}`)
      }
    } catch (err) {
      console.error(`Error procesando ${a.email}:`, err.message)
    }
  }

  console.log('Migración finalizada')
  await mongoose.disconnect()
}

migrate().catch(err => {
  console.error('Migración fallida:', err)
  process.exit(1)
})
