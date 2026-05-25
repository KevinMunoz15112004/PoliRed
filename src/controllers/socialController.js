import mongoose from 'mongoose'
import Estudiante from '../models/Estudiantes.js'
import Publicacion from '../models/Publicaciones.js'
import { Articulo } from '../models/Articulos.js'
import Comentario from '../models/Comentarios.js'
import Notificacion from '../models/Notificaciones.js'
import RedComunitaria from '../models/RedComunitaria.js'
import AdminRed from '../models/adminRedes.js'
import { crearNotificacion } from '../helpers/notificaciones.js'
import { _resolvePostDoc } from '../helpers/postResolver.js'
import { triggerUserChannel } from '../config/pusher.js'
import { sendMailRedAprobada, sendMailRedRechazada } from '../config/nodemailer.js'

// Helper `_resolvePostDoc` moved to `src/helpers/postResolver.js`

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

const darLikePublicacion = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id

    // ID validado por validators en rutas

    const resolved = await _resolvePostDoc(id)
    if (!resolved) {
      return res.status(404).json({ msg: 'Publicación no encontrada' })
    }
    const { comunidadId, autorId, isArticulo } = resolved
    const Model = isArticulo ? Articulo : Publicacion

    // Si pertenece a una comunidad deshabilitada, bloquear
    if (comunidadId) {
      const red = await RedComunitaria.findById(comunidadId)
      if (red && red.deshabilitada) return res.status(403).json({ msg: 'No puedes dar like en publicaciones de una red deshabilitada' })
    }

    // Convertir a ObjectId para evitar problemas de tipo
    const estudianteObjId = new mongoose.Types.ObjectId(estudianteId)

    // Añadir e incrementar en una sola operación atómica sólo si el usuario no tiene like aún
    const addRes = await Model.updateOne(
      { _id: id, likes: { $ne: estudianteObjId } },
      { $addToSet: { likes: estudianteObjId }, $inc: { likesCount: 1 } }
    )

    if (addRes.modifiedCount && addRes.modifiedCount > 0) {
      if (estudianteId.toString() !== autorId.toString()) {
        const unaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);

        // Buscar notificación madre existente de likes en esta publicación
        const notifExistente = await Notificacion.findOne({
          usuarioId: autorId,
          tipo: 'like',
          publicacionId: id,
          createdAt: { $gte: unaHoraAtras }
        });

        if (notifExistente) {
          // Actualizar: agregar emisor si no está ya
          const yaEsta = notifExistente.emisores.some(
            e => e.toString() === estudianteId.toString()
          );
          if (!yaEsta) {
            await Notificacion.findByIdAndUpdate(notifExistente._id, {
              $addToSet: { emisores: estudianteId },
              $inc: { totalEmisores: 1 },
              emisorId: estudianteId, // el más reciente es el principal
              leida: false,
              updatedAt: new Date()
            });
            // Emitir actualización a Pusher
            await triggerUserChannel(
              autorId.toString(),
              'notificacion_actualizada',
              { notificacionId: notifExistente._id.toString() }
            );
          }
        } else {
          // Crear nueva notificación madre
          const emisorData = await Estudiante.findById(estudianteId)
            .select('nombre apellido username fotoPerfil').lean();

          const nueva = await Notificacion.create({
            usuarioId: autorId,
            emisorId: estudianteId,
            emisores: [estudianteId],
            totalEmisores: 1,
            emisorSnap: {
              nombre: emisorData.nombre,
              apellido: emisorData.apellido,
              username: emisorData.username,
              fotoPerfil: emisorData.fotoPerfil
            },
            tipo: 'like',
            publicacionId: id,
            leida: false
          });

          // Emitir nueva notificación a Pusher
          await triggerUserChannel(
            autorId.toString(),
            'nueva_notificacion',
            {
              _id: nueva._id.toString(),
              tipo: 'like',
              emisorSnap: emisorData,
              totalEmisores: 1,
              publicacionId: id.toString(),
              leida: false,
              createdAt: nueva.createdAt,
              updatedAt: nueva.updatedAt
            }
          );
        }
      }

      const pub = await Model.findById(id).populate('likes', 'nombre apellido')
      return res.status(201).json({ msg: 'Like agregado', likes: pub.likes })
    }

    // No se modificó: el usuario ya tenía like
    const pub = await Model.findById(id).populate('likes', 'nombre apellido')
    return res.status(409).json({ msg: 'Ya diste like a esta publicación', likes: pub.likes })
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

    const resolved = await _resolvePostDoc(id)
    if (!resolved) {
      return res.status(404).json({ msg: 'Publicación no encontrada' })
    }
    const Model = resolved.isArticulo ? Articulo : Publicacion

    const estudianteObjId = new mongoose.Types.ObjectId(estudianteId)

    // Quitar y decrementar sólo si el usuario tenía like
    const pullRes = await Model.updateOne(
      { _id: id, likes: estudianteObjId },
      { $pull: { likes: estudianteObjId }, $inc: { likesCount: -1 } }
    )

    if (pullRes.modifiedCount && pullRes.modifiedCount > 0) {
      const pub = await Model.findById(id).populate('likes', 'nombre apellido')
      return res.status(200).json({ msg: 'Like removido', likes: pub.likes })
    }

    // Si no se removió, el usuario no tenía like en esa publicación
    return res.status(409).json({ msg: 'No tienes like en esta publicación' })
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

    const resolved = await _resolvePostDoc(id)
    if (!resolved) {
      return res.status(404).json({ msg: 'Publicación no encontrada' })
    }
    const { doc, autorId, comunidadId, isArticulo } = resolved
    const Model = isArticulo ? Articulo : Publicacion

    if (comunidadId) {
      const red = await RedComunitaria.findById(comunidadId)
      if (red && red.deshabilitada) return res.status(403).json({ msg: 'No puedes comentar en publicaciones de una red deshabilitada' })
    }

    const comentario = await Comentario.create({
      postId: doc._id,
      userId: estudianteId,
      contenido: contenido.trim(),
      parentId: null
    })

    // popular comentario con datos del usuario
    const comentarioPop = await Comentario.findById(comentario._id).populate('userId', 'nombre apellido')

    // Incrementar commentsCount de forma atómica
    await Model.updateOne({ _id: doc._id }, { $inc: { commentsCount: 1 } })

    if (estudianteId.toString() !== autorId.toString()) {
      const emisorData = await Estudiante.findById(estudianteId).select('nombre apellido username fotoPerfil').lean();
      const notificacion = await crearNotificacion({
        usuarioId: autorId,
        emisorId: estudianteId,
        tipo: 'comentario',
        publicacionId: doc._id,
        comentarioId: comentario._id,
        mensaje: 'Comentaron tu publicación'
      });

      await triggerUserChannel(autorId.toString(), 'nueva_notificacion', {
        _id: notificacion._id.toString(),
        tipo: notificacion.tipo,
        emisorSnap: emisorData,
        publicacionId: notificacion.publicacionId?.toString(),
        comentarioId: notificacion.comentarioId?.toString(),
        mensaje: notificacion.mensaje,
        leida: false,
        createdAt: notificacion.createdAt,
        updatedAt: notificacion.updatedAt
      });
    }

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

    // Verificar comunidad deshabilitada (funciona para Publicacion y Articulo)
    if (comentarioPadre.postId) {
      const resolved = await _resolvePostDoc(comentarioPadre.postId.toString())
      if (resolved && resolved.comunidadId) {
        const red = await RedComunitaria.findById(resolved.comunidadId)
        if (red && red.deshabilitada) return res.status(403).json({ msg: 'No puedes responder comentarios en una red deshabilitada' })
      }
    }

    const respuesta = await Comentario.create({
      postId: comentarioPadre.postId,
      userId: estudianteId,
      contenido: contenido.trim(),
      parentId: comentarioPadre._id
    })

    comentarioPadre.hijos.push(respuesta._id)
    await comentarioPadre.save()

    // Incrementar contador de comentarios en Publicacion o Articulo
    if (comentarioPadre.postId) {
      const resolved = await _resolvePostDoc(comentarioPadre.postId.toString())
      if (resolved) {
        const Model = resolved.isArticulo ? Articulo : Publicacion
        await Model.updateOne({ _id: comentarioPadre.postId }, { $inc: { commentsCount: 1 } })
      }
    }

    if (estudianteId.toString() !== comentarioPadre.userId.toString()) {
      const emisorData = await Estudiante.findById(estudianteId).select('nombre apellido username fotoPerfil').lean();
      const notificacion = await crearNotificacion({
        usuarioId: comentarioPadre.userId,
        emisorId: estudianteId,
        tipo: 'respuesta_comentario',
        publicacionId: comentarioPadre.postId,
        comentarioId: respuesta._id,
        mensaje: 'Respondieron a tu comentario'
      });

      await triggerUserChannel(comentarioPadre.userId.toString(), 'nueva_notificacion', {
        _id: notificacion._id.toString(),
        tipo: notificacion.tipo,
        emisorSnap: emisorData,
        publicacionId: notificacion.publicacionId?.toString(),
        comentarioId: notificacion.comentarioId?.toString(),
        mensaje: notificacion.mensaje,
        leida: false,
        createdAt: notificacion.createdAt,
        updatedAt: notificacion.updatedAt
      });
    }

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
      .populate('userId', 'nombre apellido email username')
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

    // Verificar que el documento existe (Publicacion o Articulo)
    const resolved = await _resolvePostDoc(id)
    const estudiante = await Estudiante.findById(estudianteId)

    if (!estudiante || !resolved) {
      return res.status(404).json({ msg: 'Estudiante o publicación no encontrados' })
    }

    const docId = resolved.doc._id
    if (!estudiante.publicacionesGuardadas.some((postId) => postId.equals(docId))) {
      estudiante.publicacionesGuardadas.push(docId)
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

    const estudiante = await Estudiante.findById(estudianteId).lean()
    if (!estudiante) {
      return res.status(404).json({ msg: 'Estudiante no encontrado' })
    }

    const ids = estudiante.publicacionesGuardadas || []
    if (ids.length === 0) {
      return res.status(200).json({ guardados: [] })
    }

    // Buscar en Publicaciones
    const publicaciones = await Publicacion.find({ _id: { $in: ids } })
      .populate('autorId', 'nombre apellido username fotoPerfil')
      .populate('comunidadId', 'nombre')
      .lean()

    // Buscar en Articulos
    const articulos = await Articulo.find({ _id: { $in: ids } })
      .populate('autorId', 'nombre apellido username fotoPerfil')
      .populate('redComunitaria', 'nombre')
      .lean()

    const guardadosIds = ids.map(id => id.toString())
    const combined = [...publicaciones, ...articulos]

    // Mapear cada elemento agregando las banderas sociales
    const mapped = combined.map(post => {
      const likes = post.likes || []
      const isLiked = likes.some(id => id.toString() === estudianteId.toString())
      const isSaved = guardadosIds.includes(post._id.toString())
      return {
        ...post,
        likedByMe: isLiked,
        isLiked: isLiked,
        savedByMe: isSaved,
        isSaved: isSaved
      }
    })

    // Mantener el orden original de guardados (de más reciente a más antiguo guardado, o según el array original)
    const idMap = new Map(mapped.map(p => [p._id.toString(), p]))
    const ordenados = ids
      .map(id => idMap.get(id.toString()))
      .filter(Boolean)

    return res.status(200).json({ guardados: ordenados })
  } catch (error) {
    console.error('Error al listar guardados:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarPublicacionesLiked = async (req, res) => {
  try {
    const estudianteId = req.user?._id

    // Buscar estudiante para obtener los guardados
    const estudiante = await Estudiante.findById(estudianteId).lean()
    if (!estudiante) {
      return res.status(404).json({ msg: 'Estudiante no encontrado' })
    }
    const guardadosIds = (estudiante.publicacionesGuardadas || []).map(id => id.toString())

    // Buscar publicaciones cuyo array `likes` contenga al estudiante
    const publicaciones = await Publicacion.find({ likes: estudianteId })
      .populate('autorId', 'nombre apellido username fotoPerfil')
      .populate('comunidadId', 'nombre')
      .lean()

    // Buscar artículos cuyo array `likes` contenga al estudiante
    const articulos = await Articulo.find({ likes: estudianteId })
      .populate('autorId', 'nombre apellido username fotoPerfil')
      .populate('redComunitaria', 'nombre')
      .lean()

    const combined = [...publicaciones, ...articulos]

    // Mapear cada elemento agregando las banderas sociales
    const mapped = combined.map(post => {
      const likes = post.likes || []
      const isLiked = likes.some(id => id.toString() === estudianteId.toString())
      const isSaved = guardadosIds.includes(post._id.toString())
      return {
        ...post,
        likedByMe: isLiked,
        isLiked: isLiked,
        savedByMe: isSaved,
        isSaved: isSaved
      }
    })

    // Ordenar combinados por fecha de creación (createdAt) descendente
    mapped.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.timestamp || 0)
      const dateB = new Date(b.createdAt || b.timestamp || 0)
      return dateB - dateA
    })

    // Paginación básica si se envía en la query
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 10
    const startIndex = (page - 1) * limit
    const paginated = mapped.slice(startIndex, startIndex + limit)

    return res.status(200).json({
      likes: paginated,
      liked: paginated
    })
  } catch (error) {
    console.error('Error al listar publicaciones con like:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarNotificaciones = async (req, res) => {
  try {
    const estudianteId = req.user?._id
    const notifs = await Notificacion.find({ usuarioId: estudianteId })
      .populate('emisorId', 'nombre apellido username fotoPerfil')
      .populate('emisores', 'nombre apellido username fotoPerfil')
      .sort({ updatedAt: -1 })
      .limit(50)
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
      const emisorIdVal = req.user?._id || null;
      if (!emisorIdVal || user._id.toString() !== emisorIdVal.toString()) {
        const notificacion = await crearNotificacion({
          usuarioId: user._id,
          emisorId: emisorIdVal,
          tipo: 'mensaje',
          mensaje: 'Tu solicitud de creación de red fue aprobada'
        });
        
        let emisorData = null;
        if (emisorIdVal) {
          emisorData = await Estudiante.findById(emisorIdVal).select('nombre apellido username fotoPerfil').lean();
        }

        await triggerUserChannel(user._id.toString(), 'nueva_notificacion', {
          _id: notificacion._id.toString(),
          tipo: notificacion.tipo,
          emisorSnap: emisorData,
          mensaje: notificacion.mensaje,
          leida: false,
          createdAt: notificacion.createdAt,
          updatedAt: notificacion.updatedAt
        });
      }

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
        const emisorIdVal = req.user?._id || null;
        if (!emisorIdVal || creadoPorId.toString() !== emisorIdVal.toString()) {
          const notificacion = await crearNotificacion({
            usuarioId: creadoPorId,
            emisorId: emisorIdVal,
            tipo: 'mensaje',
            mensaje: 'Tu solicitud de creación de red fue rechazada'
          });
          
          let emisorData = null;
          if (emisorIdVal) {
            emisorData = await Estudiante.findById(emisorIdVal).select('nombre apellido username fotoPerfil').lean();
          }

          await triggerUserChannel(creadoPorId.toString(), 'nueva_notificacion', {
            _id: notificacion._id.toString(),
            tipo: notificacion.tipo,
            emisorSnap: emisorData,
            mensaje: notificacion.mensaje,
            leida: false,
            createdAt: notificacion.createdAt,
            updatedAt: notificacion.updatedAt
          });
        }

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
    const emisorIdVal = req.user?._id || null;
    if (!emisorIdVal || user._id.toString() !== emisorIdVal.toString()) {
      const notificacion = await crearNotificacion({
        usuarioId: user._id,
        emisorId: emisorIdVal,
        tipo: 'mensaje',
        mensaje: motivo || `Se te ha revocado el rol de admin de la red ${red.nombre}`
      });

      let emisorData = null;
      if (emisorIdVal) {
        emisorData = await Estudiante.findById(emisorIdVal).select('nombre apellido username fotoPerfil').lean();
      }

      await triggerUserChannel(user._id.toString(), 'nueva_notificacion', {
        _id: notificacion._id.toString(),
        tipo: notificacion.tipo,
        emisorSnap: emisorData,
        mensaje: notificacion.mensaje,
        leida: false,
        createdAt: notificacion.createdAt,
        updatedAt: notificacion.updatedAt
      });
    }

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
    const emisorIdVal = req.user?._id || null;
    if (!emisorIdVal || user._id.toString() !== emisorIdVal.toString()) {
      const notificacion = await crearNotificacion({
        usuarioId: user._id,
        emisorId: emisorIdVal,
        tipo: 'mensaje',
        mensaje: `Has sido asignado como administrador de la red ${red.nombre}`
      });

      let emisorData = null;
      if (emisorIdVal) {
        emisorData = await Estudiante.findById(emisorIdVal).select('nombre apellido username fotoPerfil').lean();
      }

      await triggerUserChannel(user._id.toString(), 'nueva_notificacion', {
        _id: notificacion._id.toString(),
        tipo: notificacion.tipo,
        emisorSnap: emisorData,
        mensaje: notificacion.mensaje,
        leida: false,
        createdAt: notificacion.createdAt,
        updatedAt: notificacion.updatedAt
      });
    }

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

const listarLikesPublicacion = async (req, res) => {
  try {
    const { id } = req.params
    const resolved = await _resolvePostDoc(id)

    if (!resolved) {
      return res.status(404).json({ msg: 'Publicación no encontrada' })
    }

    const Model = resolved.isArticulo ? Articulo : Publicacion
    const pub = await Model.findById(id).populate('likes', 'nombre apellido username fotoPerfil email')
    return res.status(200).json({ likes: pub.likes || [] })
  } catch (error) {
    console.error('Error al listar likes:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

export {
  solicitarCreacionRed,
  darLikePublicacion,
  quitarLikePublicacion,
  crearComentarioPublicacion,
  responderComentario,
  listarComentariosArbol,
  guardarPublicacion,
  quitarGuardadoPublicacion,
  listarPublicacionesGuardadas,
  listarPublicacionesLiked,
  listarNotificaciones,
  marcarNotificacionLeida,
  listarRedesPendientesAprobacion,
  resolverAprobacionRed,
  revocarAdminRed,
  asignarDuenoRed,
  listarLikesPublicacion
}
