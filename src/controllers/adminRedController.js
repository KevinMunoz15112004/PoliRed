import AdminRed from '../models/adminRedes.js'
import Estudiante from '../models/Estudiantes.js'
import { sendMailToRecoveryPassword } from '../config/nodemailer.js'
import fs from 'fs-extra'
import cloudinary from 'cloudinary'
import profileService from '../services/profileService.js'
import Publicacion from '../models/Publicaciones.js'
import { Articulo } from '../models/Articulos.js'
import mongoose from 'mongoose'
import RedComunitaria from '../models/RedComunitaria.js'

// Controladores para la gestión de la cuenta (login movido a /api/auth/login)

const perfilAdminRed = (req, res) => {
  delete req.user.token
  delete req.user.confirmEmail
  delete req.user.createdAt
  delete req.user.updatedAt
  delete req.user.__v
  res.status(200).json(req.user)
}

const actualizarPerfilAdminRed = async (req, res) => {
  const id = req.user._id
  const campos = ["nombre", "apellido", "celular", "email"]
  const datos = {}

  for (const campo of campos) {
    if (req.body[campo] && req.body[campo].trim() !== "") {
      datos[campo] = req.body[campo]
    }
  }

  if (Object.keys(datos).length === 0) return res.status(400).json({ msg: "No se recibió ningún cambio" })

  const estudianteBDD = await Estudiante.findById(id)
  if (!estudianteBDD) return res.status(404).json({ msg: 'Usuario no encontrado' })

  if (datos.email && datos.email !== estudianteBDD.email) {
    const existeEmail = await Estudiante.findOne({ email: datos.email })
    if (existeEmail) return res.status(400).json({ msg: 'El correo ya está registrado' })
  }

  Object.assign(estudianteBDD, datos)
  await estudianteBDD.save()

  res.status(200).json({ msg: "Perfil actualizado correctamente" })
}

const actualizarPasswordAdminRed = async (req, res) => {
  const id = req.user._id
  const { passwordactual, passwordnuevo } = req.body
  // Formato/presencia de los campos de contraseña validado por validators en rutas

  const estudianteBDD = await Estudiante.findById(id)
  if (!estudianteBDD) return res.status(404).json({ msg: 'Usuario no encontrado' })

  const match = await estudianteBDD.matchPassword(passwordactual)
  if (!match) return res.status(400).json({ msg: 'La contraseña actual es incorrecta' })

  estudianteBDD.password = await estudianteBDD.encrypPassword(passwordnuevo)
  await estudianteBDD.save()

  res.status(200).json({ msg: "Contraseña actualizada correctamente" })
}

const actualizarAvatarAdminRed = async (req, res) => {
  const id = req.user._id

  const estudianteBDD = await Estudiante.findById(id)
  if (!estudianteBDD) {
    return res.status(404).json({ msg: 'Usuario no encontrado' })
  }

  try {
    // require an image for this endpoint
    const url = await profileService.handleProfileImage({ req, bodyField: 'avatar', filesField: 'imagen', folder: 'avatar_adminRed', publicIdPrefix: id, required: true })
    estudianteBDD.avatar = url
    await estudianteBDD.save()
    res.status(200).json({ msg: 'Avatar actualizado correctamente', avatar: estudianteBDD.avatar })
  } catch (err) {
    if (err && err.type === 'VALIDATION') return res.status(400).json({ msg: err.message, code: err.code })
    if (err && err.type === 'UPLOAD_ERROR') return res.status(500).json({ msg: err.message, code: err.code })
    console.error(err)
    res.status(500).json({ msg: 'Error al subir imagen' })
  }
}

const listarPublicaciones = async (req, res) => {
  try {
    if (!req.user.roles || !req.user.roles.includes('admin_red')) {
      return res.status(403).json({ msg: 'Acceso no autorizado. Solo para administradores de red.' })
    }

    // Determinar la red asignada a partir de relaciones admin
    const relaciones = req.adminRelations || []
    const activa = relaciones.find(r => r.estado === 'activo')
    const redAsignada = activa ? activa.redId : null

    if (!redAsignada) return res.status(400).json({ msg: 'El administrador no tiene una red comunitaria asignada' })

    const publicaciones = await Publicacion.find({ comunidadId: redAsignada })
      .populate('autorId', 'nombre apellido fotoPerfil')
      .populate('comunidadId', 'nombre')
      .sort({ timestamp: -1 })

    if (publicaciones.length === 0) {
      return res.status(200).json({ msg: 'No hay publicaciones disponibles', publicaciones: [] })
    }

    res.status(200).json(publicaciones)
  } catch (error) {
    console.error('Error al listar publicaciones:', error)
    res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const eliminarPublicacionAdmin = async (req, res) => {
  try {
    const { id } = req.params
    const admin = req.user

    if (!req.user.roles || !req.user.roles.includes('admin_red')) {
      return res.status(403).json({ msg: 'Acceso no autorizado. Solo administradores de red pueden eliminar publicaciones.' })
    }

    // ID validado por los validators en rutas

    const publicacion = await Publicacion.findById(id)
    if (!publicacion) {
      return res.status(404).json({ msg: 'Publicación no encontrada' })
    }

    // Determinar la red asignada a partir de relaciones admin (si existe)
    const relaciones = req.adminRelations || []
    const activa = relaciones.find(r => r.estado === 'activo')
    const redAsignada = activa ? activa.redId : null

    if (!redAsignada) return res.status(403).json({ msg: 'No tienes una red comunitaria asignada' })

    if (!publicacion.comunidadId || publicacion.comunidadId.toString() !== redAsignada.toString()) {
      return res.status(403).json({ msg: 'No tienes permiso para eliminar publicaciones de esta red' })
    }

    await Publicacion.findByIdAndDelete(id)

    return res.status(200).json({ msg: 'Publicación eliminada correctamente' })
  } catch (error) {
    console.error('Error al eliminar publicación:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarArticulosPorRedAdmin = async (req, res) => {
  try {
    if (!req.user.roles || !req.user.roles.includes('admin_red')) {
      return res.status(403).json({ msg: 'Acceso no autorizado. Solo para administradores de red.' })
    }

    const relaciones = req.adminRelations || []
    const activa = relaciones.find(r => r.estado === 'activo')
    const redAsignada = activa ? activa.redId : null

    if (!redAsignada) return res.status(400).json({ msg: 'El administrador no tiene una red comunitaria asignada' })

    const articulos = await Articulo.find({ redComunitaria: redAsignada })
      .populate('autorId', 'nombre apellido email fotoPerfil')
      .populate('redComunitaria', 'nombre')
      .sort({ createdAt: -1 })

    return res.status(200).json({
      msg: articulos.length > 0
        ? 'Artículos encontrados'
        : 'No hay artículos en venta en tu red comunitaria',
      articulos
    })

  } catch (error) {
    console.error('Error al listar artículos para admin de red:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const eliminarArticuloAdmin = async (req, res) => {
  try {
    const { id } = req.params
    const admin = req.user

    if (!req.user.roles || !req.user.roles.includes('admin_red')) {
      return res.status(403).json({ msg: 'Acceso no autorizado. Solo administradores de red pueden eliminar artículos.' })
    }

    // ID validado por los validators en rutas

    const articulo = await Articulo.findById(id)
    if (!articulo) {
      return res.status(404).json({ msg: 'Artículo no encontrado' })
    }

    // Determinar la red asignada a partir de relaciones admin (si existe)
    const relaciones = req.adminRelations || []
    const activa = relaciones.find(r => r.estado === 'activo')
    const redAsignada = activa ? activa.redId : null

    if (!redAsignada) return res.status(403).json({ msg: 'No tienes una red comunitaria asignada' })

    if (!articulo.redComunitaria || articulo.redComunitaria.toString() !== redAsignada.toString()) {
      return res.status(403).json({ msg: 'No tienes permiso para eliminar artículos de esta red' })
    }

    await Articulo.findByIdAndDelete(id)

    return res.status(200).json({ msg: 'Artículo eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar artículo:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const obtenerInfoRed = async (req, res) => {
  try {
    if (!req.user.roles || !req.user.roles.includes('admin_red')) return res.status(403).json({ msg: 'Acceso no autorizado' })

    const relaciones = req.adminRelations || []
    const activa = relaciones.find(r => r.estado === 'activo')
    if (!activa) return res.status(400).json({ msg: 'No tienes una red comunitaria asignada.' })

    const red = await RedComunitaria.findById(activa.redId).lean()
    if (!red) return res.status(404).json({ msg: 'Red comunitaria no encontrada' })

    // Contadores importantes para mostrar al admin de red
    const publicacionesCount = await Publicacion.countDocuments({ comunidadId: red._id })
    const articulosCount = await Articulo.countDocuments({ redComunitaria: red._id })

    // Asegurar que cantidadMiembros esté poblada o derivada
    const cantidadMiembros = typeof red.cantidadMiembros === 'number' ? red.cantidadMiembros : (Array.isArray(red.miembros) ? red.miembros.length : 0)

    const info = {
      _id: red._id,
      nombre: red.nombre,
      descripcion: red.descripcion,
      fotoPerfil: red.fotoPerfil || null,
      esVerificada: red.esVerificada || false,
      deshabilitada: red.deshabilitada || false,
      esGlobal: red.esGlobal || false,
      esOficial: red.esOficial || false,
      cantidadMiembros,
      publicacionesCount,
      articulosCount,
      creadaAt: red.createdAt,
      actualizadaAt: red.updatedAt
    }

    return res.status(200).json({ msg: 'Red comunitaria asignada', red: info })

  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: 'Error en el servidor' });
  }
}

const verEstudiantesDeRed = async (req, res) => {
  try {
    if (!req.user.roles || !req.user.roles.includes('admin_red')) return res.status(403).json({ msg: 'Acceso no autorizado. Solo para administradores de red.' })
    const relaciones = req.adminRelations || []
    const activa = relaciones.find(r => r.estado === 'activo')
    const redAsignada = activa ? activa.redId : null

    if (!redAsignada) return res.status(400).json({ msg: 'No tienes una red comunitaria asignada.' })

    const estudiantes = await Estudiante.find({ redComunitaria: redAsignada }).select('nombre apellido email')

    if (estudiantes.length === 0) {
      return res.status(200).json({ msg: 'No hay estudiantes en tu red comunitaria', estudiantes: [] })
    }

    res.status(200).json({ msg: 'Estudiantes encontrados', estudiantes })
  } catch (error) {
    console.error('Error al listar estudiantes:', error)
    res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const eliminarEstudianteDeRed = async (req, res) => {
  try {
    if (!req.user.roles || !req.user.roles.includes('admin_red')) {
      return res.status(403).json({ msg: 'Acceso no autorizado. Solo para administradores de red.' })
    }

    const relaciones = req.adminRelations || []
    const activa = relaciones.find(r => r.estado === 'activo')
    const redAsignadaId = activa ? activa.redId : null
    const { estudianteId } = req.params

    const estudiante = await Estudiante.findById(estudianteId)

    if (!estudiante) {
      return res.status(404).json({ msg: 'Estudiante no encontrado' })
    }

    if (!redAsignadaId) return res.status(403).json({ msg: 'No autorizado para esta acción' })
    if (!estudiante.redComunitaria || !estudiante.redComunitaria.some(r => String(r) === String(redAsignadaId))) {
      return res.status(403).json({ msg: 'No puedes modificar estudiantes que no pertenecen a tu red comunitaria' })
    }

    estudiante.redComunitaria = estudiante.redComunitaria.filter(
      redId => redId.toString() !== redAsignadaId.toString()
    )
    await estudiante.save()

    const red = await RedComunitaria.findById(redAsignadaId)
    if (red) {
      red.miembros = red.miembros.filter(
        miembroId => miembroId.toString() !== estudianteId
      )
      red.cantidadMiembros = red.miembros.length
      await red.save()
    }

    res.status(200).json({ msg: 'Estudiante removido de la red comunitaria correctamente' })
  } catch (error) {
    console.error('Error al eliminar estudiante de red:', error)
    res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const actualizarRedComunitaria = async (req, res) => {
  try {
    if (!req.user.roles || !req.user.roles.includes('admin_red')) {
      return res.status(403).json({ msg: 'Acceso no autorizado. Solo los administradores de red pueden realizar esta acción.' })
    }

    // Determinar la red asignada a partir de relaciones admin (consistente con otros controladores)
    const relaciones = req.adminRelations || []
    const activa = relaciones.find(r => r.estado === 'activo')
    const redId = activa ? activa.redId : null
    const { descripcion } = req.body

    if (!redId) {
      return res.status(400).json({ msg: 'No estás asignado a ninguna red comunitaria.' })
    }

    const red = await RedComunitaria.findById(redId)

    if (!red) {
      return res.status(404).json({ msg: 'Red comunitaria no encontrada.' })
    }

    let seActualizo = false

    const { nombre } = req.body

    // Permitir que el admin de red modifique el nombre de su propia red,
    // pero validar unicidad (excluyendo la red actual)
    if (nombre?.trim()) {
      const nombreTrim = nombre.trim()
      // Evitar colisiones por mayúsculas/minúsculas
      const existente = await RedComunitaria.findOne({ nombre: { $regex: `^${nombreTrim}$`, $options: 'i' }, _id: { $ne: red._id } })
      if (existente) return res.status(400).json({ msg: 'Ya existe una red comunitaria con ese nombre.' })
      red.nombre = nombreTrim
      seActualizo = true
    }

    if (descripcion?.trim()) {
      red.descripcion = descripcion.trim()
      seActualizo = true
    }

    // Si se sube una imagen (archivo o URL), manejarla con profileService
    if (req.files && req.files.imagen || req.body && req.body.fotoPerfil) {
      try {
        const url = await profileService.handleProfileImage({ req, bodyField: 'fotoPerfil', filesField: 'imagen', folder: 'foto_red_comunitaria', publicIdPrefix: red._id, required: false })
        if (url) {
          red.fotoPerfil = url
          seActualizo = true
        }
      } catch (err) {
        if (err && err.type === 'VALIDATION') return res.status(400).json({ msg: err.message, code: err.code })
        if (err && err.type === 'UPLOAD_ERROR') return res.status(500).json({ msg: err.message, code: err.code })
        console.error('Error al subir imagen de la red:', err)
        return res.status(500).json({ msg: 'Error al subir la imagen' })
      }
    }

    if (!seActualizo) {
      return res.status(400).json({ msg: 'Debe proporcionar al menos un campo válido para actualizar (descripción o imagen).' })
    }

    await red.save()

    res.status(200).json({ msg: 'Red comunitaria actualizada exitosamente', red })
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.nombre) {
      return res.status(400).json({ msg: 'Ya existe una red comunitaria con ese nombre.' })
    }

    console.error('Error al actualizar red comunitaria:', error)
    res.status(500).json({ msg: 'Error en el servidor' })
  }
}

export {
  perfilAdminRed,
  actualizarAvatarAdminRed,
  actualizarPerfilAdminRed,
  actualizarPasswordAdminRed,
  listarPublicaciones,
  listarArticulosPorRedAdmin,
  eliminarArticuloAdmin,
  eliminarPublicacionAdmin,
  obtenerInfoRed,
  verEstudiantesDeRed,
  eliminarEstudianteDeRed,
  actualizarRedComunitaria
}