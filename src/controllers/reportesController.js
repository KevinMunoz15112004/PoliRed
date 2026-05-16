import RedComunitaria from '../models/RedComunitaria.js'
import Publicacion from '../models/Publicaciones.js'
import ReportePublicacion from '../models/ReportePublicacion.js'
import ReporteUsuario from '../models/ReporteUsuario.js'
import ReporteApp from '../models/ReporteApp.js'
import ReporteRed from '../models/ReporteRed.js'
import Estudiante from '../models/Estudiantes.js'
import AdminRed from '../models/adminRedes.js'
import SolicitudVerificacion from '../models/SolicitudVerificacion.js'
import SolicitudRehabilitarRed from '../models/SolicitudRehabilitarRed.js'
import SolicitudHabilitarUsuario from '../models/SolicitudHabilitarUsuario.js'

// Crear reporte sobre una publicación (llega al admin de la red correspondiente)
const crearReportePublicacion = async (req, res) => {
  try {
    const { tipo, descripcion, publicacionId, archivos = [] } = req.body

    // buscar publicacion para obtener redId
    const publicacion = await Publicacion.findById(publicacionId)
    if (!publicacion) return res.status(404).json({ msg: 'Publicación no encontrada' })

    const nuevoReporte = await ReportePublicacion.create({
      tipo,
      descripcion: descripcion ? descripcion.trim() : '',
      reporterId: req.estudianteBDD ? req.estudianteBDD._id : null,
      publicacionId: publicacion._id,
      redId: publicacion.comunidadId || null,
      archivos
    })

    const reportePop = await ReportePublicacion.findById(nuevoReporte._id)
      .populate('publicacionId')
      .populate('redId', 'nombre')
      .select('-reporterId')

    return res.status(201).json({ msg: 'Reporte creado', reporte: reportePop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Crear reporte hacia una red comunitaria (llega al SuperAdmin)
const crearReporteRed = async (req, res) => {
  try {
    const { tipo, descripcion, redId, archivos = [] } = req.body

    if (!redId) return res.status(400).json({ msg: 'Falta redId' })
    const red = await RedComunitaria.findById(redId)
    if (!red) return res.status(404).json({ msg: 'Red comunitaria no encontrada' })

    const nuevoReporte = await ReporteRed.create({
      tipo,
      descripcion: descripcion ? descripcion.trim() : '',
      reporterId: req.user ? req.user._id : null,
      redId,
      archivos
    })

    const reportePop = await ReporteRed.findById(nuevoReporte._id).populate('redId', 'nombre').select('-reporterId')
    return res.status(201).json({ msg: 'Reporte creado', reporte: reportePop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Crear reporte general de la aplicación (llega al superadmin)
const crearReporteApp = async (req, res) => {
  try {
    const { tipo, descripcion, archivos = [] } = req.body

    const nuevoReporte = await ReporteApp.create({
      tipo,
      descripcion: descripcion ? descripcion.trim() : '',
      reporterId: req.estudianteBDD ? req.estudianteBDD._id : null,
      archivos
    })

    const reportePop = await ReporteApp.findById(nuevoReporte._id).select('-reporterId')
    return res.status(201).json({ msg: 'Reporte creado', reporte: reportePop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Crear reporte de usuario (llega al superadmin)
const crearReporteUsuario = async (req, res) => {
  try {
    const { tipo, descripcion, reportadoUsuarioId, archivos = [] } = req.body

    // verificar que el usuario reportado exista
    if (!reportadoUsuarioId) return res.status(400).json({ msg: 'Falta reportadoUsuarioId' })
    const usuarioReportado = await Estudiante.findById(reportadoUsuarioId)
    if (!usuarioReportado) return res.status(404).json({ msg: 'Usuario reportado no encontrado' })

    const nuevoReporte = await ReporteUsuario.create({
      tipo,
      descripcion: descripcion ? descripcion.trim() : '',
      reporterId: req.estudianteBDD ? req.estudianteBDD._id : null,
      reportadoUsuarioId,
      archivos
    })

    const reportePop = await ReporteUsuario.findById(nuevoReporte._id)
      .populate('reportadoUsuarioId', 'nombre apellido email')
      .select('-reporterId')

    return res.status(201).json({ msg: 'Reporte creado', reporte: reportePop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarReportesUsuarios = async (req, res) => {
  try {
    // Superadmin debe ver principalmente los reportes de usuarios (no los ligados a una red)
    const userReports = await ReporteUsuario.find().populate('reportadoUsuarioId', 'nombre apellido email').select('-reporterId').sort({ createdAt: -1 })
    return res.status(200).json({ reportes: userReports })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: listar reportes sobre redes comunitarias
const listarReportesRedes = async (req, res) => {
  try {
    const reportes = await ReporteRed.find().populate('redId', 'nombre deshabilitada').select('-reporterId').sort({ createdAt: -1 })
    return res.status(200).json({ reportes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarReportesApp = async (req, res) => {
  try {
    const reportes = await ReporteApp.find().select('-reporterId').sort({ createdAt: -1 })
    return res.status(200).json({ reportes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Helpers: allowed final states
const FINAL_STATES = ['Resuelta', 'Rechazada']

// SuperAdmin: resolver reporte de usuario
const resolverReporteUsuario = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, respuesta } = req.body

    if (!FINAL_STATES.includes(estado)) return res.status(400).json({ msg: 'Estado inválido. Solo se acepta "Resuelta" o "Rechazada"' })

    const reporte = await ReporteUsuario.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte de usuario no encontrado' })

    // Prevent re-processing a report that's already resolved or rejected
    if (reporte.estado === 'resuelto' || reporte.estado === 'rechazado') return res.status(400).json({ msg: 'El reporte ya fue resuelto o rechazado' })

    if (estado === 'Rechazada') {
      // Mark report as rejected instead of deleting
      reporte.estado = 'rechazado'
      if (respuesta) reporte.respuesta = respuesta
      await reporte.save()
      const reportePop = await ReporteUsuario.findById(reporte._id).populate('reportadoUsuarioId', 'nombre apellido email').select('-reporterId')
      return res.status(200).json({ msg: 'Reporte rechazado', reporte: reportePop })
    }

    // Resuelta: suspender al usuario reportado (mapear a valor del esquema)
    reporte.estado = 'resuelto'
    if (respuesta) reporte.respuesta = respuesta
    await reporte.save()

    const usuario = await Estudiante.findById(reporte.reportadoUsuarioId)
    if (usuario) {
      usuario.suspendido = true
      await usuario.save()
    }

    const reportePop = await ReporteUsuario.findById(reporte._id).populate('reportadoUsuarioId', 'nombre apellido email').select('-reporterId')
    return res.status(200).json({ msg: 'Reporte resuelto. Usuario suspendido', reporte: reportePop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: resolver reporte de red (deshabilitar la red si es aprobado)
const resolverReporteRed = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, respuesta } = req.body

    if (!FINAL_STATES.includes(estado)) return res.status(400).json({ msg: 'Estado inválido. Solo se acepta "Resuelta" o "Rechazada"' })

    const reporte = await ReporteRed.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte de red no encontrado' })

    // Prevent re-processing
    if (reporte.estado === 'resuelto' || reporte.estado === 'rechazado') return res.status(400).json({ msg: 'El reporte ya fue resuelto o rechazado' })

    if (estado === 'Rechazada') {
      reporte.estado = 'rechazado'
      if (respuesta) reporte.respuesta = respuesta
      await reporte.save()
      const reportePop = await ReporteRed.findById(reporte._id).populate('redId', 'nombre deshabilitada').select('-reporterId')
      return res.status(200).json({ msg: 'Reporte rechazado', reporte: reportePop })
    }

    // Resuelta: deshabilitar la red
    reporte.estado = 'resuelto'
    if (respuesta) reporte.respuesta = respuesta
    await reporte.save()

    const red = await RedComunitaria.findById(reporte.redId)
    if (!red) {
      const reportePop = await ReporteRed.findById(reporte._id).populate('redId', 'nombre deshabilitada').select('-reporterId')
      return res.status(200).json({ msg: 'Reporte resuelto. La red no existe', reporte: reportePop })
    }

    // Mark as disabled
    red.deshabilitada = true
    await red.save()

    const reportePop = await ReporteRed.findById(reporte._id).populate('redId', 'nombre deshabilitada').select('-reporterId')
    return res.status(200).json({ msg: 'Reporte resuelto. Red deshabilitada', reporte: reportePop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: resolver reporte de app
const resolverReporteApp = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, respuesta } = req.body

    if (!FINAL_STATES.includes(estado)) return res.status(400).json({ msg: 'Estado inválido. Solo se acepta "Resuelta" o "Rechazada"' })

    const reporte = await ReporteApp.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte de app no encontrado' })

    // Prevent re-processing a report that's already resolved
    if (reporte.estado === 'resuelto') return res.status(400).json({ msg: 'El reporte ya fue resuelto' })

    if (estado === 'Rechazada') {
      // Mark report as rejected instead of deleting
      reporte.estado = 'rechazado'
      if (respuesta) reporte.respuesta = respuesta
      await reporte.save()
      const reportePop = await ReporteApp.findById(reporte._id).select('-reporterId')
      return res.status(200).json({ msg: 'Reporte rechazado', reporte: reportePop })
    }

    // Resuelta: marcar como resuelta (mapear a valor del esquema)
    reporte.estado = 'resuelto'
    if (respuesta) reporte.respuesta = respuesta
    await reporte.save()

    const reportePop = await ReporteApp.findById(reporte._id).select('-reporterId')
    return res.status(200).json({ msg: 'Reporte de app resuelto', reporte: reportePop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// AdminRed: resolver reporte de publicación (solo puede actuar sobre su red)
const resolverReportePublicacionAdmin = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, respuesta } = req.body

    if (!FINAL_STATES.includes(estado)) return res.status(400).json({ msg: 'Estado inválido. Solo se acepta "Resuelta" o "Rechazada"' })

    const reporte = await ReportePublicacion.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte de publicación no encontrado' })

    // Prevent re-processing a report that's already resolved
    if (reporte.estado === 'resuelto') return res.status(400).json({ msg: 'El reporte ya fue resuelto' })

    const admin = req.user
    if (!admin.redAsignada || !reporte.redId || reporte.redId.toString() !== admin.redAsignada.toString()) {
      return res.status(403).json({ msg: 'No estás autorizado para resolver este reporte' })
    }

    const { eliminarPublicacion = false } = req.body

    if (estado === 'Rechazada') {
      // Mark report as rejected and keep it in DB
      reporte.estado = 'rechazado'
      if (respuesta) reporte.respuesta = respuesta
      await reporte.save()
      const reportePop = await ReportePublicacion.findById(reporte._id).populate('publicacionId').populate('redId', 'nombre').select('-reporterId')
      return res.status(200).json({ msg: 'Reporte rechazado', reporte: reportePop })
    }

    // Resuelta: admin aprueba el reporte — siempre eliminar la publicación referenciada
    reporte.estado = 'resuelto'
    if (respuesta) reporte.respuesta = respuesta
    await reporte.save()

    const publicacion = await Publicacion.findById(reporte.publicacionId)
    if (!publicacion) {
      // Publication missing — report is resolved but nothing to delete
      const reportePop = await ReportePublicacion.findById(reporte._id).populate('publicacionId').populate('redId', 'nombre').select('-reporterId')
      return res.status(200).json({ msg: 'Reporte resuelto. La publicación no existe (posible eliminación previa)', reporte: reportePop })
    }

    // Ensure publication belongs to the admin's assigned red
    if (!publicacion.comunidadId || publicacion.comunidadId.toString() !== admin.redAsignada.toString()) {
      return res.status(403).json({ msg: 'No estás autorizado para eliminar la publicación' })
    }

    // Delete the publication record (safe deletion)
    await Publicacion.findByIdAndDelete(publicacion._id)

    const reportePop = await ReportePublicacion.findById(reporte._id).populate('publicacionId').populate('redId', 'nombre').select('-reporterId')
    return res.status(200).json({ msg: 'Reporte resuelto y publicación eliminada', reporte: reportePop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarReportesAdminRed = async (req, res) => {
  try {
    const admin = req.user
    if (!admin.redAsignada) return res.status(400).json({ msg: 'No tienes red asignada' })

    const reportes = await ReportePublicacion.find({ redId: admin.redAsignada }).populate('publicacionId').select('-reporterId').sort({ createdAt: -1 })
    return res.status(200).json({ reportes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: delete a user report
const deleteReporteUsuario = async (req, res) => {
  try {
    const { id } = req.params
    const reporte = await ReporteUsuario.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte de usuario no encontrado' })
    await ReporteUsuario.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Reporte eliminado' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: delete a red report
const deleteReporteRed = async (req, res) => {
  try {
    const { id } = req.params
    const reporte = await ReporteRed.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte de red no encontrado' })
    await ReporteRed.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Reporte eliminado' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: delete an app report
const deleteReporteApp = async (req, res) => {
  try {
    const { id } = req.params
    const reporte = await ReporteApp.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte de app no encontrado' })
    await ReporteApp.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Reporte eliminado' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// AdminRed: delete a publication report (only if belongs to admin's red)
const deleteReportePublicacionAdmin = async (req, res) => {
  try {
    const { id } = req.params
    const reporte = await ReportePublicacion.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte de publicación no encontrado' })

    const admin = req.user
    if (!admin.redAsignada || !reporte.redId || reporte.redId.toString() !== admin.redAsignada.toString()) {
      return res.status(403).json({ msg: 'No estás autorizado para eliminar este reporte' })
    }

    await ReportePublicacion.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Reporte eliminado' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Solicitudes de verificación/oficialización (creadas por admin de red)
const crearSolicitudVerificacion = async (req, res) => {
  try {
    const solicitanteId = req.user?._id
    const { redId, descripcion, solicitarVerificada = false, solicitarOficial = false } = req.body

    if (!redId || !descripcion) return res.status(400).json({ msg: 'Faltan datos requeridos' })

    const red = await RedComunitaria.findById(redId)
    if (!red) return res.status(404).json({ msg: 'Red no encontrada' })

    // Verificar que el solicitante es admin de la red
    const adminRelation = await AdminRed.findOne({ usuarioId: solicitanteId, redId: redId, estado: 'activo' })
    const esCreador = red.creadaPor && red.creadaPor.equals(solicitanteId)
    if (!adminRelation && !esCreador) {
      return res.status(403).json({ msg: 'Solo el admin asignado de la red puede solicitar verificación/oficialización' })
    }

    // Asegurar que el redId enviado corresponde a la red asignada activa del admin (si existe en el req.user)
    if (req.user && req.user.redAsignada) {
      try {
        if (req.user.redAsignada.toString() !== redId.toString()) {
          return res.status(403).json({ msg: 'Solo puedes solicitar verificación para la red que tienes asignada' })
        }
      } catch (err) {
        // ignore conversion errors
      }
    }

    if (!solicitarVerificada && !solicitarOficial) {
      return res.status(400).json({ msg: 'Debes solicitar al menos "verificada" o "oficial"' })
    }

    const nuevaSolicitud = await SolicitudVerificacion.create({ redId, solicitante: solicitanteId, descripcion: descripcion.trim(), solicitarVerificada: Boolean(solicitarVerificada), solicitarOficial: Boolean(solicitarOficial) })

    const pop = await SolicitudVerificacion.findById(nuevaSolicitud._id).populate('redId', 'nombre').populate('solicitante', 'nombre apellido email')
    return res.status(201).json({ msg: 'Solicitud creada', solicitud: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// AdminRed: crear solicitud para rehabilitar (reactivar) una red deshabilitada
const crearSolicitudRehabilitar = async (req, res) => {
  try {
    const solicitanteId = req.user?._id
    const { redId, descripcion } = req.body

    if (!redId || !descripcion) return res.status(400).json({ msg: 'Faltan datos requeridos' })

    const red = await RedComunitaria.findById(redId)
    if (!red) return res.status(404).json({ msg: 'Red no encontrada' })

    // Verificar que el solicitante es admin de la red
    const adminRelation = await AdminRed.findOne({ usuarioId: solicitanteId, redId: redId, estado: 'activo' })
    const esCreador = red.creadaPor && red.creadaPor.equals(solicitanteId)
    if (!adminRelation && !esCreador) {
      return res.status(403).json({ msg: 'Solo el admin asignado de la red puede solicitar rehabilitación' })
    }

    if (!red.deshabilitada) return res.status(400).json({ msg: 'La red no está deshabilitada' })

    // Evitar solicitudes duplicadas pendientes por el mismo solicitante y red
    const existePendiente = await SolicitudRehabilitarRed.findOne({ redId, solicitante: solicitanteId, estado: 'pendiente' })
    if (existePendiente) return res.status(400).json({ msg: 'Ya existe una solicitud pendiente para esta red' })

    const nuevaSolicitud = await SolicitudRehabilitarRed.create({ redId, solicitante: solicitanteId, descripcion: descripcion.trim() })

    const pop = await SolicitudRehabilitarRed.findById(nuevaSolicitud._id).populate('redId', 'nombre').populate('solicitante', 'nombre apellido email')
    return res.status(201).json({ msg: 'Solicitud creada', solicitud: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: listar solicitudes de rehabilitar
const listarSolicitudesRehabilitar = async (req, res) => {
  try {
    const solicitudes = await SolicitudRehabilitarRed.find().populate('redId', 'nombre deshabilitada').populate('solicitante', 'nombre apellido email').sort({ createdAt: -1 })
    return res.status(200).json({ solicitudes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// AdminRed: listar SUS propias solicitudes de rehabilitar
const listarMisSolicitudesRehabilitar = async (req, res) => {
  try {
    const adminId = req.user?._id
    const solicitudes = await SolicitudRehabilitarRed.find({ solicitante: adminId }).populate('redId', 'nombre deshabilitada').populate('solicitante', 'nombre apellido email').sort({ createdAt: -1 })
    return res.status(200).json({ solicitudes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// AdminRed: listar SUS propias solicitudes de verificación/oficialización
const listarMisSolicitudesVerificacion = async (req, res) => {
  try {
    const adminId = req.user?._id
    const solicitudes = await SolicitudVerificacion.find({ solicitante: adminId }).populate('redId', 'nombre').populate('solicitante', 'nombre apellido email').sort({ createdAt: -1 })
    return res.status(200).json({ solicitudes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: delete a rehabilitar solicitud
const deleteSolicitudRehabilitar = async (req, res) => {
  try {
    const { id } = req.params
    const solicitud = await SolicitudRehabilitarRed.findById(id)
    if (!solicitud) return res.status(404).json({ msg: 'Solicitud no encontrada' })
    await SolicitudRehabilitarRed.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Solicitud eliminada' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: delete a habilitar usuario solicitud
const deleteSolicitudHabilitarUsuario = async (req, res) => {
  try {
    const { id } = req.params
    const solicitud = await SolicitudHabilitarUsuario.findById(id)
    if (!solicitud) return res.status(404).json({ msg: 'Solicitud no encontrada' })
    await SolicitudHabilitarUsuario.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Solicitud eliminada' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: delete a verificacion solicitud
const deleteSolicitudVerificacion = async (req, res) => {
  try {
    const { id } = req.params
    const solicitud = await SolicitudVerificacion.findById(id)
    if (!solicitud) return res.status(404).json({ msg: 'Solicitud no encontrada' })
    await SolicitudVerificacion.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Solicitud eliminada' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// AdminRed: delete own rehabilitar solicitud (only creator)
const deleteSolicitudRehabilitarByAdmin = async (req, res) => {
  try {
    const { id } = req.params
    const adminId = req.user?._id
    const solicitud = await SolicitudRehabilitarRed.findById(id)
    if (!solicitud) return res.status(404).json({ msg: 'Solicitud no encontrada' })
    if (String(solicitud.solicitante) !== String(adminId)) return res.status(403).json({ msg: 'No estás autorizado para eliminar esta solicitud' })
    await SolicitudRehabilitarRed.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Solicitud eliminada' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Estudiante: listar sus propios reportes de publicación
const listarMisReportesPublicacion = async (req, res) => {
  try {
    const estudianteId = req.user?._id
    const reportes = await ReportePublicacion.find({ reporterId: estudianteId }).populate('publicacionId').populate('redId', 'nombre').select('-reporterId').sort({ createdAt: -1 })
    return res.status(200).json({ reportes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Estudiante: listar sus reportes sobre redes
const listarMisReportesRed = async (req, res) => {
  try {
    const estudianteId = req.user?._id
    const reportes = await ReporteRed.find({ reporterId: estudianteId }).populate('redId', 'nombre deshabilitada').select('-reporterId').sort({ createdAt: -1 })
    return res.status(200).json({ reportes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Estudiante: eliminar su propio reporte de red
const deleteMiReporteRed = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id
    const reporte = await ReporteRed.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte no encontrado' })
    if (!reporte.reporterId || String(reporte.reporterId) !== String(estudianteId)) return res.status(403).json({ msg: 'No estás autorizado para eliminar este reporte' })
    await ReporteRed.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Reporte eliminado' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Estudiante: eliminar su propio reporte de publicación
const deleteMiReportePublicacion = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id
    const reporte = await ReportePublicacion.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte no encontrado' })
    if (!reporte.reporterId || String(reporte.reporterId) !== String(estudianteId)) return res.status(403).json({ msg: 'No estás autorizado para eliminar este reporte' })
    await ReportePublicacion.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Reporte eliminado' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Estudiante: listar sus propios reportes de app
const listarMisReportesApp = async (req, res) => {
  try {
    const estudianteId = req.user?._id
    const reportes = await ReporteApp.find({ reporterId: estudianteId }).select('-reporterId').sort({ createdAt: -1 })
    return res.status(200).json({ reportes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Estudiante: eliminar su propio reporte de app
const deleteMiReporteApp = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id
    const reporte = await ReporteApp.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte no encontrado' })
    if (!reporte.reporterId || String(reporte.reporterId) !== String(estudianteId)) return res.status(403).json({ msg: 'No estás autorizado para eliminar este reporte' })
    await ReporteApp.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Reporte eliminado' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Estudiante: listar sus reportes de usuario
const listarMisReportesUsuario = async (req, res) => {
  try {
    const estudianteId = req.user?._id
    const reportes = await ReporteUsuario.find({ reporterId: estudianteId }).populate('reportadoUsuarioId', 'nombre apellido email').select('-reporterId').sort({ createdAt: -1 })
    return res.status(200).json({ reportes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Estudiante: eliminar su propio reporte de usuario
const deleteMiReporteUsuario = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id
    const reporte = await ReporteUsuario.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte no encontrado' })
    if (!reporte.reporterId || String(reporte.reporterId) !== String(estudianteId)) return res.status(403).json({ msg: 'No estás autorizado para eliminar este reporte' })
    await ReporteUsuario.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Reporte eliminado' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Estudiante: listar sus propias solicitudes de habilitar cuenta
const listarMisSolicitudesHabilitar = async (req, res) => {
  try {
    const estudianteId = req.user?._id
    const solicitudes = await SolicitudHabilitarUsuario.find({ solicitante: estudianteId }).populate('solicitante', 'nombre apellido email suspendido').sort({ createdAt: -1 })
    return res.status(200).json({ solicitudes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Estudiante: eliminar su propia solicitud de habilitar
const deleteMiSolicitudHabilitar = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id
    const solicitud = await SolicitudHabilitarUsuario.findById(id)
    if (!solicitud) return res.status(404).json({ msg: 'Solicitud no encontrada' })
    if (String(solicitud.solicitante) !== String(estudianteId)) return res.status(403).json({ msg: 'No estás autorizado para eliminar esta solicitud' })
    await SolicitudHabilitarUsuario.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Solicitud eliminada' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: resolver solicitud de rehabilitar
const resolverSolicitudRehabilitar = async (req, res) => {
  try {
    const { id } = req.params
    const { accion, respuesta } = req.body

    if (!['Aprobar', 'Rechazar'].includes(accion)) return res.status(400).json({ msg: 'Acción inválida. Solo "Aprobar" o "Rechazar"' })

    const solicitud = await SolicitudRehabilitarRed.findById(id)
    if (!solicitud) return res.status(404).json({ msg: 'Solicitud no encontrada' })

    // Prevent resolving a request that's already been approved
    if (solicitud.estado === 'aprobada') return res.status(400).json({ msg: 'La solicitud ya fue aprobada' })

    const red = await RedComunitaria.findById(solicitud.redId)
    if (!red) return res.status(404).json({ msg: 'Red no encontrada' })

    if (accion === 'Rechazar') {
      // Mark as rejected instead of deleting
      solicitud.estado = 'rechazada'
      if (respuesta) solicitud.respuesta = respuesta
      await solicitud.save()
      const pop = await SolicitudRehabilitarRed.findById(solicitud._id).populate('redId', 'nombre deshabilitada').populate('solicitante', 'nombre apellido email')
      return res.status(200).json({ msg: 'Solicitud rechazada', solicitud: pop })
    }

    // Aprobar: reactivar red
    red.deshabilitada = false
    await red.save()

    solicitud.estado = 'aprobada'
    if (respuesta) solicitud.respuesta = respuesta
    await solicitud.save()

    const pop = await SolicitudRehabilitarRed.findById(solicitud._id).populate('redId', 'nombre deshabilitada').populate('solicitante', 'nombre apellido email')
    return res.status(200).json({ msg: 'Solicitud aprobada. Red reactivada', solicitud: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Estudiante suspendido crea solicitud para ser habilitado
const crearSolicitudHabilitarUsuario = async (req, res) => {
  try {
    const solicitanteId = req.user?._id
    const { motivo } = req.body

    if (!motivo) return res.status(400).json({ msg: 'Falta el motivo de la solicitud' })

    const estudiante = await Estudiante.findById(solicitanteId)
    if (!estudiante) return res.status(404).json({ msg: 'Usuario no encontrado' })

    if (!estudiante.suspendido) return res.status(400).json({ msg: 'El usuario no está suspendido' })

    // Evitar duplicados pendientes
    const existePendiente = await SolicitudHabilitarUsuario.findOne({ solicitante: solicitanteId, estado: 'pendiente' })
    if (existePendiente) return res.status(400).json({ msg: 'Ya existe una solicitud pendiente' })

    const nueva = await SolicitudHabilitarUsuario.create({ solicitante: solicitanteId, motivo: motivo.trim() })
    const pop = await SolicitudHabilitarUsuario.findById(nueva._id).populate('solicitante', 'nombre apellido email')
    return res.status(201).json({ msg: 'Solicitud creada', solicitud: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: listar solicitudes
const listarSolicitudesHabilitarUsuarios = async (req, res) => {
  try {
    const solicitudes = await SolicitudHabilitarUsuario.find().populate('solicitante', 'nombre apellido email suspendido').sort({ createdAt: -1 })
    return res.status(200).json({ solicitudes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: resolver solicitud (Aprobar/Rechazar)
const resolverSolicitudHabilitarUsuario = async (req, res) => {
  try {
    const { id } = req.params
    const { accion, respuesta } = req.body

    if (!['Aprobar', 'Rechazar'].includes(accion)) return res.status(400).json({ msg: 'Acción inválida. Solo "Aprobar" o "Rechazar"' })

    const solicitud = await SolicitudHabilitarUsuario.findById(id)
    if (!solicitud) return res.status(404).json({ msg: 'Solicitud no encontrada' })

    // Prevent resolving a request that's already been approved
    if (solicitud.estado === 'aprobada') return res.status(400).json({ msg: 'La solicitud ya fue aprobada' })

    const estudiante = await Estudiante.findById(solicitud.solicitante)
    if (!estudiante) return res.status(404).json({ msg: 'Estudiante no encontrado' })

    if (accion === 'Rechazar') {
      // Mark as rejected instead of deleting
      solicitud.estado = 'rechazada'
      if (respuesta) solicitud.respuesta = respuesta
      await solicitud.save()
      const pop = await SolicitudHabilitarUsuario.findById(solicitud._id).populate('solicitante', 'nombre apellido email suspendido')
      return res.status(200).json({ msg: 'Solicitud rechazada', solicitud: pop })
    }

    // Aprobar: marcar suspendido = false
    estudiante.suspendido = false
    await estudiante.save()

    solicitud.estado = 'aprobada'
    if (respuesta) solicitud.respuesta = respuesta
    await solicitud.save()

    const pop = await SolicitudHabilitarUsuario.findById(solicitud._id).populate('solicitante', 'nombre apellido email suspendido')
    return res.status(200).json({ msg: 'Solicitud aprobada. Usuario habilitado', solicitud: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: listar solicitudes pendientes
const listarSolicitudesVerificacion = async (req, res) => {
  try {
    const solicitudes = await SolicitudVerificacion.find().populate('redId', 'nombre').populate('solicitante', 'nombre apellido email').sort({ createdAt: -1 })
    return res.status(200).json({ solicitudes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// SuperAdmin: resolver solicitud (asignar esVerificada/esOficial según flags)
const resolverSolicitudVerificacion = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, asignarVerificada = false, asignarOficial = false, respuesta } = req.body

    if (!['Aprobada', 'Rechazada'].includes(estado)) return res.status(400).json({ msg: 'Estado inválido. Solo "Aprobada" o "Rechazada"' })

    const solicitud = await SolicitudVerificacion.findById(id)
    if (!solicitud) return res.status(404).json({ msg: 'Solicitud no encontrada' })

    // Prevent resolving a request that's already been approved
    if (solicitud.estado === 'aprobada') return res.status(400).json({ msg: 'La solicitud ya fue aprobada' })

    if (estado === 'Rechazada') {
      // Mark as rejected instead of deleting
      solicitud.estado = 'rechazada'
      if (respuesta) solicitud.respuesta = respuesta
      await solicitud.save()
      const pop = await SolicitudVerificacion.findById(solicitud._id).populate('redId', 'nombre').populate('solicitante', 'nombre apellido email').select('-__v')
      return res.status(200).json({ msg: 'Solicitud rechazada', solicitud: pop })
    }

    // Aprobada: aplicar banderas solicitadas por el superadmin (puede asignar solo una, ambas o ninguna)
    const red = await RedComunitaria.findById(solicitud.redId)
    if (!red) return res.status(404).json({ msg: 'Red no encontrada' })

    if (Boolean(asignarVerificada)) red.esVerificada = true
    if (Boolean(asignarOficial)) red.esOficial = true
    await red.save()

    solicitud.estado = 'aprobada'
    if (respuesta) solicitud.respuesta = respuesta
    await solicitud.save()

    const pop = await SolicitudVerificacion.findById(solicitud._id).populate('redId', 'nombre esVerificada esOficial').populate('solicitante', 'nombre apellido email').select('-__v')
    return res.status(200).json({ msg: 'Solicitud aprobada', solicitud: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

export { crearReportePublicacion, crearReporteRed, crearReporteApp, crearReporteUsuario, listarReportesUsuarios, listarReportesRedes, listarReportesApp, resolverReporteUsuario, resolverReporteRed, resolverReporteApp, resolverReportePublicacionAdmin, listarReportesAdminRed, crearSolicitudVerificacion, listarSolicitudesVerificacion, resolverSolicitudVerificacion, crearSolicitudRehabilitar, listarSolicitudesRehabilitar, resolverSolicitudRehabilitar, crearSolicitudHabilitarUsuario, listarSolicitudesHabilitarUsuarios, resolverSolicitudHabilitarUsuario, deleteReporteUsuario, deleteReporteRed, deleteReporteApp, deleteReportePublicacionAdmin, deleteSolicitudRehabilitar, deleteSolicitudHabilitarUsuario, deleteSolicitudVerificacion, deleteSolicitudRehabilitarByAdmin, listarMisSolicitudesRehabilitar, listarMisSolicitudesVerificacion, listarMisReportesPublicacion, deleteMiReportePublicacion, listarMisReportesRed, deleteMiReporteRed, listarMisReportesApp, deleteMiReporteApp, listarMisReportesUsuario, deleteMiReporteUsuario, listarMisSolicitudesHabilitar, deleteMiSolicitudHabilitar }
