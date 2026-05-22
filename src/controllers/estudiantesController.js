import Estudiante from '../models/Estudiantes.js'
import mongoose from "mongoose"
import AdminRed from '../models/adminRedes.js'
import { Articulo } from '../models/Articulos.js'
import { sendMailToRegister, sendMailToRecoveryPasswordE } from '../config/nodemailer.js'
import SuperAdmin from '../models/SuperAdmin.js'
import fs from 'fs-extra'
import { v2 as cloudinary } from 'cloudinary'
import mediaService from '../services/mediaService.js'
import profileService from '../services/profileService.js'
import Publicacion from "../models/Publicaciones.js"
import RedComunitaria from '../models/RedComunitaria.js'
import { getGlobalIds, getGlobalRedDoc, filterOutGlobalIds, populateExcludeGlobalMatch, getGlobalId } from '../helpers/globalRed.js'

// NOTE: login functionality moved to /api/auth/login (authController)

const registroEstudiante = async (req, res) => {
  try {
    const { nombre, apellido, email, password, redComunitaria } = req.body

    // Presencia y formato de campos (nombre, apellido, email, password)
    // son validados por los `validators` en las rutas.

    // Nota: el campo de teléfono fue eliminado del modelo; ya no se valida ni se guarda.

    const verificarEmailBDD = await Estudiante.findOne({ email })
    if (verificarEmailBDD) {
      return res.status(400).json({ msg: "Lo sentimos, el email ya se encuentra registrado" })
    }

    // username is optional at registration; frontend will set it later

    const verificarEmailSA = await SuperAdmin.findOne({ email })
    if (verificarEmailSA) {
      return res.status(400).json({ msg: "Lo sentimos, el email ya pertenece al Super Administrador" })
    }

    // Asignar redes globales automáticamente
    const redesGlobalIds = await getGlobalIds()

    const solicitadoRedes = Array.isArray(redComunitaria) ? redComunitaria : (redComunitaria ? [redComunitaria] : [])
    const combinado = Array.from(new Set([...solicitadoRedes.map(String), ...redesGlobalIds]))

    const nuevoEstudiante = new Estudiante({
      nombre,
      apellido,
      email,
      password,
      redComunitaria: combinado,
      roles: ['estudiante']
    })

    nuevoEstudiante.password = await nuevoEstudiante.encrypPassword(password)
    const token = nuevoEstudiante.crearToken()

    await nuevoEstudiante.save();

    // Agregar al listado de miembros de las redes asignadas (incluyendo globales)
    for (const redId of nuevoEstudiante.redComunitaria) {
      try {
        const red = await RedComunitaria.findById(redId)
        if (red) {
          const already = red.miembros && red.miembros.some(m => (m && m.equals && m.equals(nuevoEstudiante._id)) || String(m) === String(nuevoEstudiante._id))
          if (!already) {
            red.miembros.push(nuevoEstudiante._id)
            red.cantidadMiembros = red.miembros.length
            await red.save()
          }
        }
      } catch (err) {
        console.error('Error actualizando miembros de la red:', err)
      }
    }

    await sendMailToRegister(email, token)

    return res.status(201).json({
      msg: "Revisa tu correo electrónico para confirmar tu cuenta",
      estudiante: {
        id: nuevoEstudiante._id,
        nombre: nuevoEstudiante.nombre,
        apellido: nuevoEstudiante.apellido,
        email: nuevoEstudiante.email,
        roles: nuevoEstudiante.roles,
        username: nuevoEstudiante.username,
        fotoPerfil: nuevoEstudiante.fotoPerfil,
        perfilCompleto: nuevoEstudiante.perfilCompleto,
        // Excluir redes globales de la respuesta al frontend
        redComunitaria: nuevoEstudiante.redComunitaria.filter(rid => !redesGlobalIds.includes(String(rid)))
      }
    })

  } catch (error) {
    console.error("Error al registrar estudiante:", error)
    if (!res.headersSent) {
      return res.status(500).json({ msg: "Error en el servidor" })
    }
  }
}

const confirmarMailEstudiante = async (req, res) => {
  const token = req.params.token

  const estudianteBDD = await Estudiante.findOne({ token })

  if (!estudianteBDD) {
    return res.status(404).json({ msg: "Token inválido" })
  }

  if (!estudianteBDD.token) {
    return res.status(400).json({ msg: "La cuenta ya ha sido confirmada previamente" })
  }

  estudianteBDD.token = null
  estudianteBDD.confirmEmail = true

  await estudianteBDD.save();

  return res.status(200).json({ msg: "Correo confirmado, ya puedes iniciar sesión" })
}

const recuperarPasswordEstudiante = async (req, res) => {
  const { email } = req.body
  // Formato/presencia validado por validators en rutas

  const estudianteBDD = await Estudiante.findOne({ email })
  if (!estudianteBDD) {
    return res.status(404).json({ msg: "Lo sentimos, el usuario no se encuentra registrado" })
  }

  const token = estudianteBDD.crearToken()
  estudianteBDD.token = token

  await sendMailToRecoveryPasswordE(email, token)
  await estudianteBDD.save()

  return res.status(200).json({ msg: "Revisa tu correo electrónico para reestablecer tu cuenta" })
}

const comprobarTokenPasswordEstudiante = async (req, res) => {
  const { token } = req.params

  const estudianteBDD = await Estudiante.findOne({ token })
  if (!estudianteBDD || estudianteBDD.token !== token) {
    return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" })
  }

  return res.status(200).json({ msg: "Token confirmado, ya puedes crear tu nuevo password" })
}

const crearNuevoPasswordEstudiante = async (req, res) => {
  const { password, confirmpassword } = req.body
  // Formato y coincidencia de passwords validados por validators en rutas

  const estudianteBDD = await Estudiante.findOne({ token: req.params.token })
  if (!estudianteBDD || estudianteBDD.token !== req.params.token) {
    return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" })
  }

  estudianteBDD.token = null
  estudianteBDD.password = await estudianteBDD.encrypPassword(password)

  await estudianteBDD.save()

  const correoAdmin = estudianteBDD.email
  const admin = await AdminRed.findOne({ email: correoAdmin })

  if (admin) {
    admin.password = await admin.encrypPassword(password)
    await admin.save();
  }

  return res.status(200).json({ msg: "Felicitaciones, ya puedes iniciar sesión con tu nuevo password" })
}

const perfilEstudiante = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ msg: 'Usuario no autenticado' })

    // Remove sensitive/internal fields
    delete req.user.token
    delete req.user.confirmEmail
    delete req.user.createdAt
    delete req.user.updatedAt
    delete req.user.__v

    // Count total publicaciones and articulos authored by this estudiante
    const [postsCount, articlesCount] = await Promise.all([
      Publicacion.countDocuments({ autorId: req.user._id }),
      Articulo.countDocuments({ autorId: req.user._id })
    ]);
    const publicacionesCount = postsCount + articlesCount;

    // Excluir redes globales del objeto `req.user` antes de enviarlo al frontend
    const redesGlobalIdsSet = new Set(await getGlobalIds())
    const safeUser = { ...req.user }
    if (Array.isArray(safeUser.redComunitaria)) {
      safeUser.redComunitaria = safeUser.redComunitaria.filter(rid => !redesGlobalIdsSet.has(String(rid)))
    }

    return res.status(200).json({ ...safeUser, publicacionesCount })
  } catch (error) {
    console.error('Error en perfilEstudiante:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const actualizarUsername = async (req, res) => {
  try {
    const estudianteId = req.user?._id
    const { username } = req.body

    if (!estudianteId) return res.status(401).json({ msg: 'Usuario no autenticado' })
    if (!username || !username.trim()) return res.status(400).json({ msg: 'Username requerido' })

    const usernameTrim = username.trim()
    if (usernameTrim.length < 3 || usernameTrim.length > 20) {
      return res.status(400).json({ msg: 'Username debe tener entre 3 y 20 caracteres' })
    }

    const regex = /^[A-Za-z0-9._-]+$/
    if (!regex.test(usernameTrim)) {
      return res.status(400).json({ msg: 'Username inválido. Sólo letras, números, puntos, guiones bajos y guiones.' })
    }

    const existe = await Estudiante.findOne({ username: usernameTrim })
    if (existe && existe._id.toString() !== estudianteId.toString()) {
      return res.status(400).json({ msg: 'El username ya está en uso' })
    }

    const estudiante = await Estudiante.findById(estudianteId)
    if (!estudiante) return res.status(404).json({ msg: 'Estudiante no encontrado' })

    estudiante.username = usernameTrim
    await estudiante.save()

    return res.status(200).json({ msg: 'Username actualizado', username: estudiante.username })
  } catch (error) {
    console.error('Error al actualizar username:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const completarPerfil = async (req, res) => {
  try {
    const estudianteId = req.user?._id
    const { username, fotoPerfil, biografia } = req.body

    if (!estudianteId) return res.status(401).json({ msg: 'Usuario no autenticado' })

    if (req.user && req.user.perfilCompleto) {
      return res.status(403).json({ msg: 'El perfil ya está completo' })
    }

    const usernameTrim = username ? String(username).trim() : ''
    if (!usernameTrim) return res.status(400).json({ msg: 'Username requerido' })
    if (usernameTrim.length < 3 || usernameTrim.length > 20) return res.status(400).json({ msg: 'Username debe tener entre 3 y 20 caracteres' })
    const regex = /^[A-Za-z0-9._-]+$/
    if (!regex.test(usernameTrim)) return res.status(400).json({ msg: 'Username inválido' })

    const existe = await Estudiante.findOne({ username: usernameTrim })
    if (existe && existe._id.toString() !== estudianteId.toString()) {
      return res.status(400).json({ msg: 'El username ya está en uso' })
    }

    const estudiante = await Estudiante.findById(estudianteId)
    if (!estudiante) return res.status(404).json({ msg: 'Estudiante no encontrado' })

    estudiante.username = usernameTrim
    estudiante.fotoPerfil = fotoPerfil || estudiante.fotoPerfil || null

    // If an image file or fotoPerfil provided in body, handle centrally
    try {
      const url = await profileService.handleProfileImage({ req, bodyField: 'fotoPerfil', filesField: 'imagen', folder: 'avatar_estudiantes', publicIdPrefix: estudianteId, required: false })
      if (url) estudiante.fotoPerfil = url
    } catch (err) {
      if (err && err.type === 'VALIDATION') return res.status(400).json({ msg: err.message, code: err.code })
      if (err && err.type === 'UPLOAD_ERROR') return res.status(500).json({ msg: err.message, code: err.code })
      console.error('Error subiendo avatar a Cloudinary:', err)
      return res.status(500).json({ msg: 'Error subiendo avatar' })
    }
    if (typeof biografia !== 'undefined' && biografia !== null) {
      const bioTrim = String(biografia).trim()
      if (bioTrim.length > 150) return res.status(400).json({ msg: 'La biografía no puede exceder 150 caracteres' })
      estudiante.biografia = bioTrim || null
    }
    estudiante.perfilCompleto = true
    await estudiante.save()

    return res.status(200).json({ msg: 'Perfil completado', usuario: {
      _id: estudiante._id,
      nombre: estudiante.nombre,
      apellido: estudiante.apellido,
      email: estudiante.email,
      roles: estudiante.roles,
      username: estudiante.username,
      fotoPerfil: estudiante.fotoPerfil,
      biografia: estudiante.biografia,
      perfilCompleto: estudiante.perfilCompleto
    }})
  } catch (error) {
    console.error('Error al completar perfil:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const actualizarPerfilEstudiante = async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, email, redComunitaria, biografia } = req.body || {}

  // El ID es validado por los validators en las rutas

  // Permitir actualizar sólo con una imagen: considerar tanto campos en body como archivos subidos
  const tieneDatosEnBody = Object.values(req.body || {}).some(valor => {
    if (valor === null || typeof valor === 'undefined') return false
    if (typeof valor === 'string') return valor.trim() !== ''
    return true
  })

  const tieneArchivoImagen = req.files && (Array.isArray(req.files.imagen) ? req.files.imagen.length > 0 : !!req.files.imagen)

  if (!tieneDatosEnBody && !tieneArchivoImagen) {
    return res.status(400).json({ msg: "Lo sentimos, debes llenar al menos un campo para actualizar" })
  }

  // Validaciones de formato para nombre/apellido/email realizadas por los validators en rutas


  const estudianteBDD = await Estudiante.findById(id)
  if (!estudianteBDD) {
    return res.status(404).json({ msg: `Lo sentimos, no existe el estudiante ${id}` })
  }

  if (email && email !== estudianteBDD.email) {
    const estudianteBDDMail = await Estudiante.findOne({ email })
    if (estudianteBDDMail) {
      return res.status(400).json({ msg: "Lo sentimos, el email ya se encuentra registrado" })
    }
    estudianteBDD.email = email
  }

  if (nombre) estudianteBDD.nombre = nombre
  if (apellido) estudianteBDD.apellido = apellido
  if (typeof biografia !== 'undefined') {
    const bioTrim = biografia === null ? null : String(biografia).trim()
    // La longitud y formato de `biografia` son validados por `validators.actualizarPerfilValidator` en las rutas
    estudianteBDD.biografia = bioTrim
  }
  if (redComunitaria) {
    // No permitir remover redes globales: siempre mantenerlas
    const redesGlobalIds = await getGlobalIds()

    const solicitado = Array.isArray(redComunitaria) ? redComunitaria.map(String) : [String(redComunitaria)]
    const combinado = Array.from(new Set([...solicitado, ...redesGlobalIds]))
    estudianteBDD.redComunitaria = combinado
  }

  // If an image file was uploaded, upload to Cloudinary and override fotoPerfil
  try {
    const url = await profileService.handleProfileImage({ req, bodyField: 'fotoPerfil', filesField: 'imagen', folder: 'avatar_estudiantes', publicIdPrefix: id, required: false })
    if (url) estudianteBDD.fotoPerfil = url
  } catch (err) {
    if (err && err.type === 'VALIDATION') return res.status(400).json({ msg: err.message, code: err.code })
    if (err && err.type === 'UPLOAD_ERROR') return res.status(500).json({ msg: err.message, code: err.code })
    console.error('Error subiendo avatar a Cloudinary:', err)
    return res.status(500).json({ msg: 'Error subiendo avatar' })
  }

  await estudianteBDD.save()

  // Excluir redes globales de la respuesta al frontend
  const redComunitariaSafe = await filterOutGlobalIds(estudianteBDD.redComunitaria)

  res.status(200).json({
    msg: "Perfil actualizado correctamente",
    estudiante: {
      id: estudianteBDD._id,
      nombre: estudianteBDD.nombre,
      apellido: estudianteBDD.apellido,
      email: estudianteBDD.email,
      redComunitaria: redComunitariaSafe,
      biografia: estudianteBDD.biografia,
      fotoPerfil: estudianteBDD.fotoPerfil
    }
  })
}

const actualizarPasswordEstudiante = async (req, res) => {
  const estudianteBDD = await Estudiante.findById(req.user?._id)

  if (!estudianteBDD) {
    return res.status(404).json({ msg: "Lo sentimos, no existe el estudiante" })
  }

  // Formato/presencia de campos de contraseña validado por validators en rutas

  const verificarPassword = await estudianteBDD.matchPassword(req.body.passwordactual)

  if (!verificarPassword) {
    return res.status(400).json({ msg: "Lo sentimos, la contraseña actual no es correcta" })
  }

  estudianteBDD.password = await estudianteBDD.encrypPassword(req.body.passwordnuevo)
  await estudianteBDD.save()

  res.status(200).json({ msg: "Contraseña actualizada correctamente" })
}

const obtenerRedesComunitarias = async (req, res) => {
  try {
    // Excluir redes globales del listado general
    const redes = await RedComunitaria.find({ esGlobal: { $ne: true } })
      .select('nombre descripcion cantidadMiembros esOficial esVerificada fotoPerfil')
      .lean()

    const salida = redes.map(r => ({
      id: r._id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      cantidadMiembros: r.cantidadMiembros,
      esOficial: r.esOficial,
      esVerificada: r.esVerificada,
      fotoPerfil: r.fotoPerfil || null
    }))

    res.status(200).json(salida)
  } catch (error) {
    console.error('Error al obtener redes comunitarias:', error)
    res.status(500).json({ msg: 'Error del servidor' })
  }
}

const unirseARedComunitaria = async (req, res) => {
  const estudianteId = req.user?._id
  const { redId } = req.body

  try {
    const red = await RedComunitaria.findById(redId)
    if (!red) {
      return res.status(404).json({ msg: 'La red comunitaria no existe' })
    }

    if (red.deshabilitada) {
      return res.status(403).json({ msg: 'La red comunitaria está deshabilitada y no se puede unir nadie.' })
    }

    const estudiante = await Estudiante.findById(estudianteId)
    if (!estudiante) {
      return res.status(404).json({ msg: 'Estudiante no encontrado' })
    }

    if (estudiante.redComunitaria.some(r => r.equals(red._id))) {
      return res.status(400).json({ msg: "Ya perteneces a esta red comunitaria" })
    }

    estudiante.redComunitaria.push(red._id)
    await estudiante.save()

    red.miembros.push(estudiante._id)
    red.cantidadMiembros = red.miembros.length
    await red.save()

    res.status(200).json({
      msg: 'Te has unido exitosamente a la red comunitaria',
      red: {
        id: red._id,
        nombre: red.nombre,
        descripcion: red.descripcion
      }
    })
  } catch (error) {
    console.error('Error al unirse a la red:', error)
    res.status(500).json({ msg: 'Error del servidor' })
  }
}


const listarRedesDelEstudiante = async (req, res) => {
  try {
    const estudianteId = req.user?._id

    const estudiante = await Estudiante.findById(estudianteId)
      .populate({ path: 'redComunitaria', select: 'nombre descripcion fotoPerfil', ...(populateExcludeGlobalMatch()) })

    if (!estudiante) {
      return res.status(404).json({ msg: "Estudiante no encontrado" })
    }

    const filteredRedes = (estudiante.redComunitaria || []).filter(Boolean);
    res.status(200).json({ redes: filteredRedes })
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: "Error del servidor" })
  }
}

const salirseDeRedComunitaria = async (req, res) => {
  const estudianteId = req.user?._id
  const { redId } = req.body

  try {
    const red = await RedComunitaria.findById(redId)
    if (!red) return res.status(404).json({ msg: 'La red comunitaria no existe' })

    // No permitir salir de redes globales
    if (red.esGlobal) {
      return res.status(400).json({ msg: 'No puedes salir de la red global' })
    }

    const estudiante = await Estudiante.findById(estudianteId)
    if (!estudiante) return res.status(404).json({ msg: 'Estudiante no encontrado' })

    const pertenece = estudiante.redComunitaria && estudiante.redComunitaria.some(r => r.equals(red._id))
    if (!pertenece) {
      return res.status(400).json({ msg: 'No perteneces a esta red comunitaria' })
    }

    // Verificar si el estudiante es admin de la red
    const adminActivo = await AdminRed.findOne({ usuarioId: estudianteId, redId: red._id, estado: 'activo' })
    if (adminActivo || (red.creadaPor && red.creadaPor.equals(estudianteId))) {
      return res.status(400).json({ msg: 'Eres administrador de esta red. Ponte en contacto con el Super Administrador para que revoque tu rol de admin de red antes de salir.' })
    }

    // Remover la red del estudiante
    estudiante.redComunitaria = estudiante.redComunitaria.filter(r => !r.equals(red._id))
    await estudiante.save()

    // Remover el estudiante de los miembros de la red
    if (red.miembros && red.miembros.some(m => m.equals(estudiante._id))) {
      red.miembros = red.miembros.filter(m => !m.equals(estudiante._id))
      red.cantidadMiembros = red.miembros.length
      await red.save()
    }

    return res.status(200).json({ msg: 'Has salido correctamente de la red comunitaria' })
  } catch (error) {
    console.error('Error al salirse de la red:', error)
    return res.status(500).json({ msg: 'Error del servidor' })
  }
}

const crearPublicacion = async (req, res) => {
  try {
    const { titulo, contenido, comunidadId, categoria, tipoContenido } = req.body
    const estudianteId = req.user?._id
    // `categoria` y campos relacionados son validados por los `validators` en las rutas
    const cat = String(categoria).trim().toLowerCase()

    let targetComunidadId = comunidadId
    let redGlobal = null

    // Reglas específicas por categoría
    if (cat === 'comunidad') {
      // Must provide comunidadId and it must NOT be global
      if (!targetComunidadId) return res.status(400).json({ msg: 'La categoría "Comunidad" requiere el id de una red comunitaria' })
      // comunidadId format validated by validators in routes
    } else {
      // noticias: comunidadId optional -> default to global
      if (!targetComunidadId) {
        redGlobal = await getGlobalRedDoc()
        if (!redGlobal) return res.status(500).json({ msg: 'No hay red global configurada' })
        targetComunidadId = redGlobal._id.toString()
      }
    }

    const estudianteBDD = await Estudiante.findById(estudianteId)
    if (!estudianteBDD) {
      return res.status(404).json({ msg: "Estudiante no encontrado" })
    }

    // Tipo de contenido ya validado por los validators; solo gestionar media si corresponde
    const tipo = tipoContenido ? String(tipoContenido).trim().toLowerCase() : 'texto'
    let finalMediaUrls = []
    if (tipo === 'imagen') {
      try {
        finalMediaUrls = await mediaService.handleMedia({ req, bodyField: 'mediaUrls', filesField: 'imagen', folder: 'publicaciones', publicIdPrefix: estudianteId })
      } catch (err) {
        if (err && err.type === 'VALIDATION') return res.status(400).json({ msg: err.message, code: err.code })
        if (err && err.type === 'UPLOAD_ERROR') return res.status(500).json({ msg: err.message, code: err.code })
        console.error('Error procesando imágenes:', err)
        return res.status(500).json({ msg: 'Error procesando imágenes', code: 'UNKNOWN_ERROR' })
      }
    }

    // Obtener doc de la red objetivo para determinar si es global
    const redDoc = await RedComunitaria.findById(targetComunidadId)
    if (!redDoc) return res.status(404).json({ msg: 'Red comunitaria no encontrada' })

    if (redDoc.deshabilitada) return res.status(403).json({ msg: 'No puedes publicar en una red deshabilitada' })

    const pertenece = estudianteBDD.redComunitaria && estudianteBDD.redComunitaria.some(r => r.equals(targetComunidadId))
    const esGlobalTarget = Boolean(redDoc.esGlobal)

    if (cat === 'comunidad') {
      // comunidad: user must belong to that red (no auto-join), and red must not be global
      if (esGlobalTarget) return res.status(400).json({ msg: 'No se puede publicar categoría Comunidad en la red global' })
      if (!pertenece) return res.status(403).json({ msg: 'No perteneces a esta red comunitaria' })
    } else {
      // noticias/cursos: if target is global and user not member, auto-join; if non-global and user not member -> forbid
      if (!pertenece) {
        if (esGlobalTarget) {
          try {
            estudianteBDD.redComunitaria = estudianteBDD.redComunitaria || []
            estudianteBDD.redComunitaria.push(redDoc._id)
            await estudianteBDD.save()

            const alreadyMember = redDoc.miembros && redDoc.miembros.some(m => (m && m.equals && m.equals(estudianteBDD._id)) || String(m) === String(estudianteBDD._id))
            if (!alreadyMember) {
              redDoc.miembros.push(estudianteBDD._id)
              redDoc.cantidadMiembros = redDoc.miembros.length
              await redDoc.save()
            }
          } catch (err) {
            console.error('Error añadiendo estudiante a red global:', err)
          }
        } else {
          return res.status(403).json({ msg: 'No perteneces a esta red comunitaria' })
        }
      }
    }

    const nuevaPublicacion = new Publicacion({
      autorId: estudianteId,
      comunidadId: targetComunidadId,
      titulo: titulo ? String(titulo).trim() : null,
      contenido: contenido ? String(contenido).trim() : '',
      tipoContenido: tipo,
      categoria: cat,
      mediaUrls: tipo === 'imagen' ? finalMediaUrls : []
    })

    await nuevaPublicacion.save()

    return res.status(201).json({
      msg: "Publicación creada correctamente",
      publicacion: nuevaPublicacion
    })
  } catch (error) {
    console.error("Error al crear publicación:", error)
    return res.status(500).json({ msg: "Error en el servidor" })
  }
}

const eliminarPublicacion = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id

    // ID validado por los validators en rutas

    const publicacion = await Publicacion.findById(id)
    if (!publicacion) {
      return res.status(404).json({ msg: 'Publicación no encontrada' })
    }

    if (!publicacion.autorId.equals(estudianteId)) {
      return res.status(403).json({ msg: 'No tienes permiso para eliminar esta publicación' })
    }

    await Publicacion.findByIdAndDelete(id)

    return res.status(200).json({ msg: 'Publicación eliminada correctamente' })
  } catch (error) {
    console.error('Error al eliminar publicación:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}


const listarPublicacionesPorRed = async (req, res) => {
  try {
    const { redId } = req.params

    // `redId` validado por validators en rutas

    const redExiste = await RedComunitaria.findById(redId)
    if (!redExiste) {
      return res.status(404).json({ msg: 'Red comunitaria no encontrada' })
    }

    const publicaciones = await Publicacion.find({ comunidadId: redId })
      .populate('autorId', 'nombre apellido fotoPerfil')
      .populate('comunidadId', 'nombre')
      .sort({ timestamp: -1 });

    return res.status(200).json({
      msg: publicaciones.length > 0
        ? 'Publicaciones encontradas'
        : 'Aún no hay publicaciones en esta red',
      publicaciones
    })
  } catch (error) {
    console.error('Error al listar publicaciones por red:', error)
    res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarPublicacionesGlobal = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query

    const redGlobal = await getGlobalRedDoc()
    if (!redGlobal) return res.status(404).json({ msg: 'No hay red global configurada' })

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50)
    const skip = (pageNumber - 1) * limitNumber

    const [items, total] = await Promise.all([
      Publicacion.find({ comunidadId: redGlobal._id })
        .populate('autorId', 'nombre apellido username fotoPerfil')
        // No popular la comunidad para evitar exponer la red global al cliente
        .sort({ timestamp: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Publicacion.countDocuments({ comunidadId: redGlobal._id })
    ])

    return res.status(200).json({ page: pageNumber, total, items })
  } catch (error) {
    console.error('Error al listar publicaciones globales:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarPublicacionesComunidades = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query

    const comunidades = await RedComunitaria.find({ esGlobal: { $ne: true } }).select('_id')
    const comunidadIds = comunidades.map(c => c._id)

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50)
    const skip = (pageNumber - 1) * limitNumber

    if (comunidadIds.length === 0) {
      return res.status(200).json({ page: pageNumber, total: 0, items: [] })
    }

    const [items, total] = await Promise.all([
      Publicacion.find({ comunidadId: { $in: comunidadIds } })
        .populate('autorId', 'nombre apellido username fotoPerfil')
        .populate('comunidadId', 'nombre')
        .sort({ timestamp: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Publicacion.countDocuments({ comunidadId: { $in: comunidadIds } })
    ])

    return res.status(200).json({ page: pageNumber, total, items })
  } catch (error) {
    console.error('Error al listar publicaciones de comunidades:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const publicarArticulo = async (req, res) => {
  try {
    const { titulo, descripcion, precio, comunidadId, categoria, tipoContenido } = req.body
    const estudianteId = req.user?._id

    const estudianteBDD = await Estudiante.findById(estudianteId)
    if (!estudianteBDD) {
      return res.status(404).json({ msg: "Estudiante no encontrado" })
    }

    // `categoria` y campos relacionados son validados por `validators.publicarArticuloValidator` en las rutas
    const cat = String(categoria).trim().toLowerCase()

    // `precio` validado por los validators; aquí se normaliza/convierte según la lógica de negocio

    let precioGuardado
    if (typeof precio === 'string') {
      if (precio.trim().toLowerCase() === 'gratis') {
        precioGuardado = 'Gratis'
      } else {
        // try parse as number
        const parsed = Number(precio)
        if (Number.isNaN(parsed) || parsed < 0) return res.status(400).json({ msg: 'Precio inválido' })
        precioGuardado = parsed
      }
    } else if (typeof precio === 'number') {
      if (!isFinite(precio) || precio < 0) return res.status(400).json({ msg: 'Precio inválido' })
      precioGuardado = precio
    } else {
      return res.status(400).json({ msg: 'Precio inválido' })
    }

    // Determine target comunidad: optional -> default to global
    let targetComunidadId = comunidadId
    let redGlobal = null
    if (!targetComunidadId) {
      redGlobal = await getGlobalRedDoc()
      if (!redGlobal) return res.status(500).json({ msg: 'No hay red global configurada' })
      targetComunidadId = redGlobal._id.toString()
    }

    const redDoc = await RedComunitaria.findById(targetComunidadId)
    if (!redDoc) return res.status(404).json({ msg: 'Red comunitaria no encontrada' })
    if (redDoc.deshabilitada) return res.status(403).json({ msg: 'No puedes publicar artículos en una red deshabilitada' })

    const pertenece = estudianteBDD.redComunitaria && estudianteBDD.redComunitaria.some(r => r.equals(targetComunidadId))
    const esGlobalTarget = Boolean(redDoc.esGlobal)

    if (!pertenece) {
      if (esGlobalTarget) {
        try {
          estudianteBDD.redComunitaria = estudianteBDD.redComunitaria || []
          estudianteBDD.redComunitaria.push(redDoc._id)
          await estudianteBDD.save()

          const alreadyMember = redDoc.miembros && redDoc.miembros.some(m => (m && m.equals && m.equals(estudianteBDD._id)) || String(m) === String(estudianteBDD._id))
          if (!alreadyMember) {
            redDoc.miembros.push(estudianteBDD._id)
            redDoc.cantidadMiembros = redDoc.miembros.length
            await redDoc.save()
          }
        } catch (err) {
          console.error('Error añadiendo estudiante a red global:', err)
        }
      } else {
        return res.status(403).json({ msg: "No perteneces a esta red comunitaria" })
      }
    }

    // Tipo de contenido validado por los validators; cuando sea imagen, procesar media
    const tipo = tipoContenido ? String(tipoContenido).trim().toLowerCase() : 'texto'
    let finalMediaUrls = []
    if (tipo === 'imagen') {
      try {
        finalMediaUrls = await mediaService.handleMedia({ req, bodyField: 'mediaUrls', filesField: 'imagen', folder: 'articulos', publicIdPrefix: estudianteId })
      } catch (err) {
        if (err && err.type === 'VALIDATION') return res.status(400).json({ msg: err.message, code: err.code })
        if (err && err.type === 'UPLOAD_ERROR') return res.status(500).json({ msg: err.message, code: err.code })
        console.error('Error procesando imágenes:', err)
        return res.status(500).json({ msg: 'Error procesando imágenes', code: 'UNKNOWN_ERROR' })
      }
    }

    const articuloCategoria = cat === 'cursos' ? 'cursos' : 'venta'

    const nuevoArticulo = new Articulo({
      autorId: estudianteId,
      redComunitaria: targetComunidadId,
      titulo: titulo ? String(titulo).trim() : null,
      descripcion: descripcion ? String(descripcion).trim() : '',
      precio: precioGuardado,
      mediaUrls: finalMediaUrls.length ? finalMediaUrls : [],
      categoria: articuloCategoria,
      tipoContenido: tipo
    })

    await nuevoArticulo.save()

    return res.status(201).json({
      msg: "Artículo publicado correctamente",
      articulo: nuevoArticulo
    })
  } catch (error) {
    console.error("Error al publicar artículo:", error)
    return res.status(500).json({ msg: "Error interno del servidor" })
  }
}


// Listar artículos que pertenecen a la red global
const listarArticulosGlobal = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query

    const redGlobal = await getGlobalRedDoc()
    if (!redGlobal) return res.status(404).json({ msg: 'No hay red global configurada' })

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50)
    const skip = (pageNumber - 1) * limitNumber

    const [items, total] = await Promise.all([
      Articulo.find({ redComunitaria: redGlobal._id })
        .populate('autorId', 'nombre apellido username fotoPerfil')
        // Evitar popular la red global en la respuesta
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Articulo.countDocuments({ redComunitaria: redGlobal._id })
    ])

    return res.status(200).json({ page: pageNumber, total, items })
  } catch (error) {
    console.error('Error al listar artículos globales:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Listar artículos en redes comunitarias (no-global)
const listarArticulosComunidades = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query

    const comunidades = await RedComunitaria.find({ esGlobal: { $ne: true } }).select('_id')
    const comunidadIds = comunidades.map(c => c._id)

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50)
    const skip = (pageNumber - 1) * limitNumber

    if (comunidadIds.length === 0) {
      return res.status(200).json({ page: pageNumber, total: 0, items: [] })
    }

    const [items, total] = await Promise.all([
      Articulo.find({ redComunitaria: { $in: comunidadIds } })
        .populate('autorId', 'nombre apellido username fotoPerfil')
        .populate('redComunitaria', 'nombre')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Articulo.countDocuments({ redComunitaria: { $in: comunidadIds } })
    ])

    return res.status(200).json({ page: pageNumber, total, items })
  } catch (error) {
    console.error('Error al listar artículos de comunidades:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarArticulosPorRed = async (req, res) => {
  try {
    const { redId } = req.params

    // `redId` validado por validators en rutas

    const redExiste = await RedComunitaria.findById(redId)
    if (!redExiste) {
      return res.status(404).json({ msg: 'Red comunitaria no encontrada' })
    }

    const articulos = await Articulo.find({ redComunitaria: redId })
      .populate('autorId', 'nombre apellido fotoPerfil')
      .populate('redComunitaria', 'nombre')
      .sort({ timestamp: -1 })

    return res.status(200).json({
      msg: articulos.length > 0
        ? 'Artículos encontrados'
        : 'Aún no hay artículos publicados en esta red',
      articulos
    })
  } catch (error) {
    console.error('Error al listar artículos por red:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const eliminarArticulo = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id

    // ID validado por los validators en rutas

    const articulo = await Articulo.findById(id)
    if (!articulo) {
      return res.status(404).json({ msg: 'Artículo no encontrado' })
    }

    if (!articulo.autorId.equals(estudianteId)) {
      return res.status(403).json({ msg: 'No tienes permiso para eliminar este artículo' })
    }

    await Articulo.findByIdAndDelete(id)

    return res.status(200).json({ msg: 'Artículo eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar artículo:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const obtenerEstudiantes = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const skip = (pageNumber - 1) * limitNumber;

    const [estudiantes, total] = await Promise.all([
      Estudiante.find({ status: true, rol: 'Estudiante' })
        .select('_id nombre apellido email username fotoPerfil biografia redComunitaria')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Estudiante.countDocuments({ status: true, rol: 'Estudiante' })
    ]);

    res.json({
      page: pageNumber,
      total,
      hasMore: skip + estudiantes.length < total,
      items: estudiantes
    });
  } catch (error) {
    console.error('Error al obtener estudiantes:', error);
    res.status(500).json({ msg: 'Error al obtener estudiantes' });
  }
};

// Obtener perfil de una red (datos + publicaciones paginadas)
const obtenerPerfilRed = async (req, res) => {
  try {
    const { redId } = req.params
    const { page = 1, limit = 12 } = req.query

    const red = await RedComunitaria.findById(redId).select('nombre descripcion cantidadMiembros fotoPerfil esOficial esVerificada creadaPor')
    if (!red) return res.status(404).json({ msg: 'Red comunitaria no encontrada' })

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50)
    const skip = (pageNumber - 1) * limitNumber

    const [items, total] = await Promise.all([
      Publicacion.find({ comunidadId: redId })
        .populate('autorId', 'nombre apellido username fotoPerfil')
        .populate('comunidadId', 'nombre')
        .sort({ timestamp: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Publicacion.countDocuments({ comunidadId: redId })
    ])

    return res.status(200).json({
      red: {
        id: red._id,
        nombre: red.nombre,
        descripcion: red.descripcion,
        cantidadMiembros: red.cantidadMiembros,
        fotoPerfil: red.fotoPerfil,
        esOficial: red.esOficial,
        esVerificada: red.esVerificada,
        creadaPor: red.creadaPor,
        publicacionesCount: total
      },
      page: pageNumber,
      total,
      items
    })
  } catch (error) {
    console.error('Error al obtener perfil de la red:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const obtenerPerfilPublicoInfo = async (req, res) => {
  try {
    const { usuarioId } = req.params;

    // `usuarioId` validado por `validators.mongoIdParam('usuarioId')` en la ruta

    const estudiante = await Estudiante.findOne({ _id: usuarioId, status: true })
      .select('_id nombre apellido username fotoPerfil biografia redComunitaria')
      .populate({ path: 'redComunitaria', select: '_id nombre fotoPerfil acronym', ...(populateExcludeGlobalMatch()) });

    if (!estudiante) {
      return res.status(404).json({ msg: 'Estudiante no encontrado' });
    }

    const [postsCount, articlesCount] = await Promise.all([
      Publicacion.countDocuments({ autorId: usuarioId }),
      Articulo.countDocuments({ autorId: usuarioId })
    ]);

    const filteredRedes = (estudiante.redComunitaria || []).filter(Boolean);

    const stats = {
      publicacionesCount: postsCount + articlesCount,
      redesCount: filteredRedes.length
    };

    return res.status(200).json({
      _id: estudiante._id,
      nombre: estudiante.nombre,
      apellido: estudiante.apellido,
      username: estudiante.username,
      fotoPerfil: estudiante.fotoPerfil,
      biografia: estudiante.biografia,
      redComunitaria: filteredRedes,
      stats
    });
  } catch (error) {
    console.error('Error al obtener perfil público:', error);
    return res.status(500).json({ msg: 'Error en el servidor' });
  }
}

const obtenerPerfilPublicoFeed = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 12, 1);
    const skip = (page - 1) * limit;

    // `usuarioId` validado por `validators.mongoIdParam('usuarioId')` en la ruta

    const queryLimit = page * limit;
    const [posts, articles] = await Promise.all([
      Publicacion.find({ autorId: usuarioId })
        .populate('autorId', 'nombre apellido username fotoPerfil')
        .populate('comunidadId', 'nombre')
        .sort({ timestamp: -1, createdAt: -1 })
        .limit(queryLimit),
      Articulo.find({ autorId: usuarioId })
        .populate('autorId', 'nombre apellido username fotoPerfil')
        .populate('redComunitaria', 'nombre')
        .sort({ createdAt: -1 })
        .limit(queryLimit)
    ]);

    const merged = [...posts, ...articles];

    merged.sort((a, b) => {
      const dateA = a.timestamp || a.createdAt || 0;
      const dateB = b.timestamp || b.createdAt || 0;
      return new Date(dateB) - new Date(dateA);
    });

    const items = merged.slice(skip, skip + limit);

    const [totalPosts, totalArticles] = await Promise.all([
      Publicacion.countDocuments({ autorId: usuarioId }),
      Articulo.countDocuments({ autorId: usuarioId })
    ]);
    const total = totalPosts + totalArticles;

    return res.status(200).json({
      page,
      total,
      hasMore: skip + items.length < total,
      items
    });
  } catch (error) {
    console.error('Error al obtener feed público:', error);
    return res.status(500).json({ msg: 'Error en el servidor' });
  }
}

export {
  registroEstudiante,
  confirmarMailEstudiante,
  recuperarPasswordEstudiante,
  comprobarTokenPasswordEstudiante,
  crearNuevoPasswordEstudiante,
  perfilEstudiante,
  actualizarUsername,
  completarPerfil,
  actualizarPerfilEstudiante,
  actualizarPasswordEstudiante,
  obtenerRedesComunitarias,
  obtenerPerfilRed,
  unirseARedComunitaria,
  listarRedesDelEstudiante,
  salirseDeRedComunitaria,
  listarPublicacionesPorRed,
  listarPublicacionesGlobal,
  listarPublicacionesComunidades,
  crearPublicacion,
  eliminarPublicacion,
  publicarArticulo,
  listarArticulosPorRed,
  eliminarArticulo,
  listarArticulosGlobal,
  listarArticulosComunidades,
  obtenerEstudiantes,
  obtenerPerfilPublicoInfo,
  obtenerPerfilPublicoFeed
}
