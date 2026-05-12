import mongoose from 'mongoose'
import Estudiante from '../models/Estudiantes.js'
import Publicacion from '../models/Publicaciones.js'
import Comentario from '../models/Comentarios.js'
import Notificacion from '../models/Notificaciones.js'
import RedComunitaria from '../models/RedComunitaria.js'
import AdminRed from '../models/adminRedes.js'
import { crearNotificacion } from '../helpers/notificaciones.js'
import { sendMailRedAprobada, sendMailRedRechazada } from '../config/nodemailer.js'

// Controladores para funcionalidades sociales

const solicitarCreacionRed = async (req, res) => {
  try {
    const { nombre, descripcion, fotoPerfil } = req.body
    const estudianteId = req.user?._id

    // Formato/presencia de `nombre` y `descripcion` validados por validators en rutas

    // Evitar duplicados por nombre
    const existe = await RedComunitaria.findOne({ nombre: nombre.trim() })
    if (existe) return res.status(409).json({ msg: 'Ya existe una red con ese nombre' })

    const nuevaRed = await RedComunitaria.create({
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      fotoPerfil: fotoPerfil || null,
      creadaPor: estudianteId,
      estadoAprobacion: 'pendiente'
    })

    // Responder con la red creada (pendiente)
    return res.status(201).json({ msg: 'Solicitud enviada', red: nuevaRed })
  } catch (error) {
    console.error('Error al solicitar creación de red:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const crearPublicacion = async (req, res) => {
  try {
    const { titulo, contenido, comunidadId, tipoContenido, categoria, mediaUrl } = req.body
    const estudianteId = req.user?._id

    // Validaciones básicas
    if (!titulo || !titulo.trim()) return res.status(400).json({ msg: 'Título requerido' })

    if (comunidadId && !mongoose.Types.ObjectId.isValid(comunidadId)) {
      return res.status(400).json({ msg: 'ID de comunidad no válido' })
    }

    const publicacion = await Publicacion.create({
      titulo: titulo.trim(),
      contenido: contenido ? contenido.trim() : '',
      comunidadId: comunidadId || null,
      tipoContenido: tipoContenido || 'texto',
      categoria: categoria || null,
      mediaUrl: mediaUrl || null,
      autorId: estudianteId
    })

    // Crear notificación para la comunidad o para seguidores, según la lógica
    if (comunidadId) {
      await crearNotificacion({
        usuarioId: comunidadId,
        emisorId: estudianteId,
        tipo: 'nueva_publicacion_comunidad',
        publicacionId: publicacion._id,
        mensaje: 'Nueva publicación en la comunidad'
      })
    }

    return res.status(201).json({ msg: 'Publicación creada', publicacion })
  } catch (error) {
    console.error('Error al crear publicación:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const crearPublicacionExtendida = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id

    // ID validado por validators en rutas

    const publicacion = await Publicacion.findById(id)
    if (!publicacion) {
      return res.status(404).json({ msg: 'Publicación no encontrada' })
    }

    // Popular autor, comunidad y likes
    const publicacionPop = await Publicacion.findById(id)
      .populate('autorId', 'nombre apellido')
      .populate('comunidadId', 'nombre')
      .populate('likes', 'nombre apellido')

    // Obtener comentarios desde el modelo Comentario (con user info)
    const comentarios = await Comentario.find({ postId: id }).populate('userId', 'nombre apellido').sort({ createdAt: 1 })

    return res.status(200).json({ publicacion: publicacionPop, comentarios })
  } catch (error) {
    console.error('Error al crear publicación extendida:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const darLikePublicacion = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id

    // ID validado por validators en rutas

    const publicacion = await Publicacion.findById(id)
    if (!publicacion) {
      return res.status(404).json({ msg: 'Publicación no encontrada' })
    }

    const yaTieneLike = publicacion.likes.some((likeId) => likeId.equals(estudianteId))
      if (yaTieneLike) {
        // devolver lista poblada de quienes dieron like
        const pub = await Publicacion.findById(id).populate('likes', 'nombre apellido')
        return res.status(200).json({ msg: 'La publicación ya tenía like', likes: pub.likes })
      }

      publicacion.likes.push(estudianteId)
    // actualizar contador
    publicacion.likesCount = publicacion.likes.length
    await publicacion.save()

      await crearNotificacion({
        usuarioId: publicacion.autorId,
        emisorId: estudianteId,
        tipo: 'like',
        publicacionId: publicacion._id,
        mensaje: 'Le dieron like a tu publicación'
      })

      const pub = await Publicacion.findById(id).populate('likes', 'nombre apellido')
      return res.status(200).json({ msg: 'Like agregado', likes: pub.likes })
  } catch (error) {
    console.error('Error al dar like:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const quitarLikePublicacion = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id

    // ID validado por validators en rutas

    const publicacion = await Publicacion.findById(id)
    if (!publicacion) {
      return res.status(404).json({ msg: 'Publicación no encontrada' })
    }

    publicacion.likes = publicacion.likes.filter((likeId) => !likeId.equals(estudianteId))
    // actualizar contador
    publicacion.likesCount = publicacion.likes.length
    await publicacion.save()

    const pub = await Publicacion.findById(id).populate('likes', 'nombre apellido')
    return res.status(200).json({ msg: 'Like removido', likes: pub.likes })
  } catch (error) {
    console.error('Error al quitar like:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const crearComentarioPublicacion = async (req, res) => {
  try {
    const { id } = req.params
    const { contenido } = req.body
    const estudianteId = req.user?._id

    // ID validado por validators en rutas

    // `contenido` validado por validators en rutas

    const publicacion = await Publicacion.findById(id)
    if (!publicacion) {
      return res.status(404).json({ msg: 'Publicación no encontrada' })
    }

    const comentario = await Comentario.create({
      postId: publicacion._id,
      userId: estudianteId,
      contenido: contenido.trim(),
      parentId: null
    })

    // popular comentario con datos del usuario
    const comentarioPop = await Comentario.findById(comentario._id).populate('userId', 'nombre apellido')

    publicacion.comentarios.push({
      autorId: estudianteId,
      contenido: contenido.trim(),
      timestamp: new Date()
    })
    // actualizar contador de comentarios
    publicacion.commentsCount = publicacion.comentarios.length
    await publicacion.save()

    await crearNotificacion({
      usuarioId: publicacion.autorId,
      emisorId: estudianteId,
      tipo: 'comentario',
      publicacionId: publicacion._id,
      comentarioId: comentario._id,
      mensaje: 'Comentaron tu publicación'
    })

    return res.status(201).json({ msg: 'Comentario creado', comentario: comentarioPop })
  } catch (error) {
    console.error('Error al crear comentario:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const responderComentario = async (req, res) => {
  try {
    const { comentarioId } = req.params
    const { contenido } = req.body
    const estudianteId = req.user?._id

    // ID validado por validators en rutas

    // `contenido` validado por validators en rutas

    const comentarioPadre = await Comentario.findById(comentarioId)
    if (!comentarioPadre) {
      return res.status(404).json({ msg: 'Comentario padre no encontrado' })
    }

    const respuesta = await Comentario.create({
      postId: comentarioPadre.postId,
      userId: estudianteId,
      contenido: contenido.trim(),
      parentId: comentarioPadre._id
    })

    comentarioPadre.hijos.push(respuesta._id)
    await comentarioPadre.save()

    await crearNotificacion({
      usuarioId: comentarioPadre.userId,
      emisorId: estudianteId,
      tipo: 'respuesta_comentario',
      publicacionId: comentarioPadre.postId,
      comentarioId: respuesta._id,
      mensaje: 'Respondieron a tu comentario'
    })

    return res.status(201).json({ msg: 'Respuesta creada', respuesta })
  } catch (error) {
    console.error('Error al responder comentario:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarComentariosArbol = async (req, res) => {
  try {
    const { id } = req.params

    // ID validado por validators en rutas

    const comentarios = await Comentario.find({ postId: id })
      .populate('userId', 'nombre apellido email')
      .sort({ createdAt: 1 })
      .lean()

    const mapa = new Map()
    const raices = []

    for (const comentario of comentarios) {
      mapa.set(comentario._id.toString(), { ...comentario, hijos: [] })
    }

    for (const comentario of comentarios) {
      const actual = mapa.get(comentario._id.toString())
      if (comentario.parentId) {
        const padre = mapa.get(comentario.parentId.toString())
        if (padre) padre.hijos.push(actual)
      } else {
        raices.push(actual)
      }
    }

    return res.status(200).json({ comentarios: raices })
  } catch (error) {
    console.error('Error al listar comentarios:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const guardarPublicacion = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id

    // ID validado por validators en rutas

    const [estudiante, publicacion] = await Promise.all([
      Estudiante.findById(estudianteId),
      Publicacion.findById(id)
    ])

    if (!estudiante || !publicacion) {
      return res.status(404).json({ msg: 'Estudiante o publicación no encontrados' })
    }

    if (!estudiante.publicacionesGuardadas.some((postId) => postId.equals(publicacion._id))) {
      estudiante.publicacionesGuardadas.push(publicacion._id)
      await estudiante.save()
    }

    return res.status(200).json({ msg: 'Publicación guardada correctamente' })
  } catch (error) {
    console.error('Error al guardar publicación:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const quitarGuardadoPublicacion = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id

    // ID validado por validators en rutas

    const estudiante = await Estudiante.findById(estudianteId)
    if (!estudiante) {
      return res.status(404).json({ msg: 'Estudiante no encontrado' })
    }

    estudiante.publicacionesGuardadas = estudiante.publicacionesGuardadas.filter((postId) => !postId.equals(id))
    await estudiante.save()

    return res.status(200).json({ msg: 'Publicación removida de guardados' })
  } catch (error) {
    console.error('Error al quitar guardado:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarPublicacionesGuardadas = async (req, res) => {
  try {
    const estudianteId = req.user?._id

    const estudiante = await Estudiante.findById(estudianteId)
      .populate({
        path: 'publicacionesGuardadas',
        populate: [
          { path: 'autorId', select: 'nombre apellido' },
          { path: 'comunidadId', select: 'nombre' }
        ]
      })

    if (!estudiante) {
      return res.status(404).json({ msg: 'Estudiante no encontrado' })
    }

    return res.status(200).json({ guardados: estudiante.publicacionesGuardadas })
  } catch (error) {
    console.error('Error al listar guardados:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Note: feed and per-red feed listing consolidated into `estudiantesController`.

// --- Stubs for missing features (to be implemented) ---

const unirseARedAprobada = async (req, res) => {
  return res.status(501).json({ msg: 'Not implemented: unirseARedAprobada' })
}

const salirDeRedComunitaria = async (req, res) => {
  return res.status(501).json({ msg: 'Not implemented: salirDeRedComunitaria' })
}

const crearConversacion = async (req, res) => {
  return res.status(501).json({ msg: 'Not implemented: crearConversacion' })
}

const listarConversaciones = async (req, res) => {
  return res.status(501).json({ msg: 'Not implemented: listarConversaciones' })
}

const enviarMensajeConversacion = async (req, res) => {
  return res.status(501).json({ msg: 'Not implemented: enviarMensajeConversacion' })
}

const listarMensajesConversacion = async (req, res) => {
  return res.status(501).json({ msg: 'Not implemented: listarMensajesConversacion' })
}

const listarNotificaciones = async (req, res) => {
  try {
    const estudianteId = req.user?._id
    const notifs = await Notificacion.find({ usuarioId: estudianteId }).sort({ createdAt: -1 })
    return res.status(200).json({ notificaciones: notifs })
  } catch (error) {
    console.error('Error al listar notificaciones:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const marcarNotificacionLeida = async (req, res) => {
  try {
    const { id } = req.params
    // ID validado por validators en rutas
    const notif = await Notificacion.findById(id)
    if (!notif) return res.status(404).json({ msg: 'Notificación no encontrada' })
    notif.leida = true
    await notif.save()
    return res.status(200).json({ msg: 'Notificación marcada como leída' })
  } catch (error) {
    console.error('Error al marcar notificación:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const subirArchivoMultimedia = async (req, res) => {
  return res.status(501).json({ msg: 'Not implemented: subirArchivoMultimedia' })
}

const marcarRedOficialAdmin = async (req, res) => {
  return res.status(501).json({ msg: 'Not implemented: marcarRedOficialAdmin' })
}

const listarRedesPendientesAprobacion = async (req, res) => {
  try {
    const redes = await RedComunitaria.find({ estadoAprobacion: 'pendiente' })
      .populate('creadaPor', 'nombre apellido email')
      .sort({ createdAt: -1 })

    return res.status(200).json({ redes })
  } catch (error) {
    console.error('Error al listar redes pendientes:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const resolverAprobacionRed = async (req, res) => {
  try {
    const { redId } = req.params
    const { accion } = req.body

    // `redId` validado por validators en rutas

    const red = await RedComunitaria.findById(redId)
    if (!red) return res.status(404).json({ msg: 'Red no encontrada' })

    if (accion === 'aprobar') {
      // Validar estado previo
      if (red.estadoAprobacion && red.estadoAprobacion !== 'pendiente') {
        return res.status(400).json({ msg: 'La red no está en estado pendiente' })
      }

      // Encontrar al usuario creador (creadaPor)
      const userId = red.creadaPor
      if (!userId) return res.status(400).json({ msg: 'La red no tiene asociado un creador' })

      const user = await Estudiante.findById(userId)
      if (!user) return res.status(404).json({ msg: 'Usuario creador no encontrado' })

      // Asegurar rol 'admin_red'
      if (!Array.isArray(user.roles)) user.roles = []
      if (!user.roles.includes('admin_red')) {
        user.roles.push('admin_red')
        await user.save()
      }

      // Añadir al usuario como miembro de la red si no está
      if (!Array.isArray(user.redComunitaria)) user.redComunitaria = []
      if (!user.redComunitaria.some(rid => rid.toString() === red._id.toString())) {
        user.redComunitaria.push(red._id)
        await user.save()
      }

      // Crear relación en adminRedes si no existe
      const existeRel = await AdminRed.findOne({ usuarioId: user._id, redId: red._id })
      if (!existeRel) {
        await AdminRed.create({
          usuarioId: user._id,
          redId: red._id,
          estado: 'activo',
          permisos: ['gestion_publicaciones', 'gestionar_miembros'],
          fechaAprobacion: new Date()
        })
      }

      // Actualizar red: marcar aprobada y asegurarse que el creador esté en miembros
      red.estadoAprobacion = 'aprobada'
      if (!Array.isArray(red.miembros)) red.miembros = []
      if (!red.miembros.some(mid => mid.toString() === user._id.toString())) {
        red.miembros.push(user._id)
      }
      red.cantidadMiembros = red.miembros.length
      await red.save()

      // Notificar al creador
      await crearNotificacion({
        usuarioId: user._id,
        emisorId: req.user?._id || null,
        tipo: 'mensaje',
        mensaje: 'Tu solicitud de creación de red fue aprobada'
      })

      try {
        if (user.email) {
          await sendMailRedAprobada(user.email, red.nombre)
        }
      } catch (e) {
        console.error('Error al enviar email de red aprobada:', e)
      }

      return res.status(200).json({ msg: 'Red aprobada', red })
    }

    if (accion === 'rechazar') {
      // Al rechazar, eliminamos la red y notificamos al creador
      const creadoPorId = red.creadaPor
      // `remove()` puede no estar disponible en algunas versiones de Mongoose;
      // usar `findByIdAndDelete` para eliminar de forma segura.
      await RedComunitaria.findByIdAndDelete(red._id)

      if (creadoPorId) {
        await crearNotificacion({
          usuarioId: creadoPorId,
          emisorId: req.user?._id || null,
          tipo: 'mensaje',
          mensaje: 'Tu solicitud de creación de red fue rechazada'
        })

        try {
          const creador = await Estudiante.findById(creadoPorId)
          if (creador && creador.email) {
            await sendMailRedRechazada(creador.email, red.nombre)
          }
        } catch (e) {
          console.error('Error al enviar email de red rechazada:', e)
        }
      }

      return res.status(200).json({ msg: 'Red rechazada y eliminada' })
    }
    return res.status(400).json({ msg: 'Acción no válida. Debe ser "aprobar" o "rechazar"' })
  } catch (error) {
    console.error('Error al resolver aprobación de red:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: revocar rol de admin de red a un estudiante para una red
const revocarAdminRed = async (req, res) => {
  try {
    const { redId } = req.params
    const { usuarioId, motivo = null } = req.body

    // `redId` y `usuarioId` validados por validators en rutas

    const red = await RedComunitaria.findById(redId)
    if (!red) return res.status(404).json({ msg: 'Red no encontrada' })

    const user = await Estudiante.findById(usuarioId)
    if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' })

    // Buscar relación y marcarla como revocada
    const rel = await AdminRed.findOne({ usuarioId: user._id, redId: red._id })
    if (rel) {
      rel.estado = 'revocado'
      await rel.save()
    }

    // Quitar rol admin_red del usuario (si estaba)
    if (Array.isArray(user.roles) && user.roles.includes('admin_red')) {
      user.roles = user.roles.filter(r => r !== 'admin_red')
      await user.save()
    }

    // Si la red tenía creadaPor apuntando a este admin, quitarla
    const wasCreator = red.creadaPor && red.creadaPor.toString() === user._id.toString()
    if (wasCreator) {
      red.creadaPor = null
      await red.save()
    }

    // Crear notificación interna
    await crearNotificacion({
      usuarioId: user._id,
      emisorId: req.user?._id || null,
      tipo: 'mensaje',
      mensaje: motivo || `Se te ha revocado el rol de admin de la red ${red.nombre}`
    })

    return res.status(200).json({ msg: 'Rol revocado correctamente', red })
  } catch (error) {
    console.error('Error al revocar admin de red:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: asignar un estudiante como dueño/admin de una red sin dueño
const asignarDuenoRed = async (req, res) => {
  try {
    const { redId } = req.params
    const { usuarioId } = req.body

    // `redId` y `usuarioId` validados por validators en rutas

    const red = await RedComunitaria.findById(redId)
    if (!red) return res.status(404).json({ msg: 'Red no encontrada' })

    if (red.creadaPor) return res.status(400).json({ msg: 'La red ya tiene un administrador asignado' })

    const user = await Estudiante.findById(usuarioId)
    if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' })

    // Añadir rol admin_red si no lo tiene
    if (!Array.isArray(user.roles)) user.roles = []
    if (!user.roles.includes('admin_red')) {
      user.roles.push('admin_red')
      await user.save()
    }

    // Añadir red a user.redComunitaria si no está
    if (!Array.isArray(user.redComunitaria)) user.redComunitaria = []
    if (!user.redComunitaria.some(rid => rid.toString() === red._id.toString())) {
      user.redComunitaria.push(red._id)
      await user.save()
    }

    // Crear relation en adminRedes si no existe
    const existeRel = await AdminRed.findOne({ usuarioId: user._id, redId: red._id })
    if (!existeRel) {
      await AdminRed.create({
        usuarioId: user._id,
        redId: red._id,
        estado: 'activo',
        permisos: ['gestion_publicaciones', 'gestionar_miembros'],
        fechaAprobacion: new Date()
      })
    } else {
      // si existe pero estaba revocado, marcar activo
      if (existeRel.estado !== 'activo') {
        existeRel.estado = 'activo'
        existeRel.fechaAprobacion = new Date()
        await existeRel.save()
      }
    }

    // Asignar como administrador (creadaPor)
    red.creadaPor = user._id
    if (!Array.isArray(red.miembros)) red.miembros = []
    if (!red.miembros.some(mid => mid.toString() === user._id.toString())) red.miembros.push(user._id)
    red.cantidadMiembros = red.miembros.length
    await red.save()

    // Notificar y opcionalmente enviar correo
    await crearNotificacion({
      usuarioId: user._id,
      emisorId: req.user?._id || null,
      tipo: 'mensaje',
      mensaje: `Has sido asignado como administrador de la red ${red.nombre}`
    })

    try {
      if (user.email) await sendMailRedAprobada(user.email, red.nombre)
    } catch (e) {
      console.error('Error enviando correo al nuevo dueño:', e)
    }

    return res.status(200).json({ msg: 'Dueño asignado correctamente', red })
  } catch (error) {
    console.error('Error al asignar dueño de red:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const eliminarPublicacionSuperAdmin = async (req, res) => {
  return res.status(501).json({ msg: 'Not implemented: eliminarPublicacionSuperAdmin' })
}

export {
  solicitarCreacionRed,
  crearPublicacion,
  crearPublicacionExtendida,
  darLikePublicacion,
  quitarLikePublicacion,
  crearComentarioPublicacion,
  responderComentario,
  listarComentariosArbol,
  guardarPublicacion,
  quitarGuardadoPublicacion,
  listarPublicacionesGuardadas,
  unirseARedAprobada,
  salirDeRedComunitaria,
  crearConversacion,
  listarConversaciones,
  enviarMensajeConversacion,
  listarMensajesConversacion,
  listarNotificaciones,
  marcarNotificacionLeida,
  subirArchivoMultimedia,
  marcarRedOficialAdmin,
  listarRedesPendientesAprobacion,
  resolverAprobacionRed,
  revocarAdminRed,
  asignarDuenoRed,
  eliminarPublicacionSuperAdmin
}
