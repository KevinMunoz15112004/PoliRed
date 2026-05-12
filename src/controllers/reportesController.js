import RedComunitaria from '../models/RedComunitaria.js'
import Publicacion from '../models/Publicaciones.js'
import ReportePublicacion from '../models/ReportePublicacion.js'
import ReporteUsuario from '../models/ReporteUsuario.js'
import ReporteApp from '../models/ReporteApp.js'
import Estudiante from '../models/Estudiantes.js'
import AdminRed from '../models/adminRedes.js'
import SolicitudVerificacion from '../models/SolicitudVerificacion.js'

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

    if (estado === 'Rechazada') {
      await ReporteUsuario.findByIdAndDelete(id)
      return res.status(200).json({ msg: 'Reporte rechazado y eliminado' })
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

// SuperAdmin: resolver reporte de app
const resolverReporteApp = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, respuesta } = req.body

    if (!FINAL_STATES.includes(estado)) return res.status(400).json({ msg: 'Estado inválido. Solo se acepta "Resuelta" o "Rechazada"' })

    const reporte = await ReporteApp.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte de app no encontrado' })

    if (estado === 'Rechazada') {
      await ReporteApp.findByIdAndDelete(id)
      return res.status(200).json({ msg: 'Reporte rechazado y eliminado' })
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

    const admin = req.user
    if (!admin.redAsignada || !reporte.redId || reporte.redId.toString() !== admin.redAsignada.toString()) {
      return res.status(403).json({ msg: 'No estás autorizado para resolver este reporte' })
    }

    if (estado === 'Rechazada') {
      await ReportePublicacion.findByIdAndDelete(id)
      return res.status(200).json({ msg: 'Reporte rechazado y eliminado' })
    }

    // Resuelta: marcar como resuelta (mapear a valor del esquema)
    reporte.estado = 'resuelto'
    if (respuesta) reporte.respuesta = respuesta
    await reporte.save()

    const reportePop = await ReportePublicacion.findById(reporte._id).populate('publicacionId').populate('redId', 'nombre').select('-reporterId')
    return res.status(200).json({ msg: 'Reporte de publicación resuelto', reporte: reportePop })
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

    if (estado === 'Rechazada') {
      await SolicitudVerificacion.findByIdAndDelete(id)
      return res.status(200).json({ msg: 'Solicitud rechazada y eliminada' })
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

export { crearReportePublicacion, crearReporteApp, crearReporteUsuario, listarReportesUsuarios, listarReportesApp, resolverReporteUsuario, resolverReporteApp, resolverReportePublicacionAdmin, listarReportesAdminRed, crearSolicitudVerificacion, listarSolicitudesVerificacion, resolverSolicitudVerificacion }
