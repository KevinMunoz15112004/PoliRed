import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import Estudiante from '../src/models/Estudiantes.js'
import AdminRedRelation from '../src/models/adminRedes.js'
import RedComunitaria from '../src/models/RedComunitaria.js'

async function migrate() {
  if (!process.env.MONGODB_URI_LOCAL) {
    console.error('Falta MONGODB_URI_LOCAL en .env')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI_LOCAL)
  console.log('Conectado a DB')

  const adminCollection = mongoose.connection.db.collection('adminRedes')
  const cursor = adminCollection.find()
  let count = 0
  while (await cursor.hasNext()) {
    const doc = await cursor.next()
    count++
    try {
      // Si el documento ya tiene usuarioId y redId, saltar
      if (doc.usuarioId && doc.redId) continue

      // Legacy admin user with email/password
      if (doc.email) {
        let est = await Estudiante.findOne({ email: doc.email })
        if (!est) {
          // Crear estudiante mínimo
          const nuevo = new Estudiante({
            nombre: doc.nombre || 'Admin',
            apellido: doc.apellido || 'Red',
            usuario: doc.email.split('@')[0],
            email: doc.email,
            password: doc.password || null,
            confirmEmail: doc.confirmEmail || false,
            roles: doc.status ? ['estudiante', 'admin_red'] : ['estudiante']
          })
          est = await nuevo.save()
          console.log(`Creado Estudiante ${est.email}`)
        } else {
          // asegurar rol admin_red si parecía ser admin activo
          if (doc.status && !est.roles.includes('admin_red')) {
            est.roles.push('admin_red')
            await est.save()
            console.log(`Rol admin_red añadido a ${est.email}`)
          }
        }

        // crear/actualizar relación AdminRed en nueva colección
        const redId = doc.redAsignada || doc.redId || null
        if (redId) {
          const existing = await AdminRedRelation.findOne({ usuarioId: est._id, redId })
          if (!existing) {
            const rel = new AdminRedRelation({ usuarioId: est._id, redId, estado: doc.status ? 'activo' : 'pendiente' })
            await rel.save()
            console.log(`Admin relation creada para ${est.email} -> red ${redId}`)
          }
        }

        // Actualizar RedComunitaria.ownerAdmin -> adminPrincipalId
        if (doc._id) {
          await RedComunitaria.updateMany({ ownerAdmin: doc._id }, { $set: { adminPrincipalId: est._id } })
        }
      }
    } catch (err) {
      console.error('Error migrando doc:', err.message)
    }
  }

  console.log(`Procesados ${count} documentos de adminRedes`)
  await mongoose.disconnect()
  console.log('Migración completa')
}

migrate().catch(err => { console.error(err); process.exit(1) })
