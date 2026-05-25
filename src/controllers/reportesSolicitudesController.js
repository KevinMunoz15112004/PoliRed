import ReporteUnificado from '../models/Reportes.js'
import SolicitudUnificada from '../models/Solicitudes.js'
import RedComunitaria from '../models/RedComunitaria.js'
import Publicacion from '../models/Publicaciones.js'
import Estudiante from '../models/Estudiantes.js'
import AdminRed from '../models/adminRedes.js'

// Helpers
const mapEstadoFromBody = (valor) => {
  if (!valor) return null
  if (valor === 'Resuelta' || valor === 'resuelta') return 'resuelto'
  if (valor === 'Rechazada' || valor === 'rechazada') return 'rechazado'
  // allow direct normalized values
  const v = String(valor).toLowerCase()
  if (['pendiente','en_progreso','resuelto','rechazado','aprobada'].includes(v)) return v
  return null
}

// Create report: publication
const crearReportePublicacion = async (req, res) => {
  try {
    const { tipo, descripcion, publicacionId, archivos = [] } = req.body
    const publicacion = await Publicacion.findById(publicacionId)
    if (!publicacion) return res.status(404).json({ msg: 'Publicación no encontrada' })

    const nuevo = await ReporteUnificado.create({
      subtype: 'publicacion',
      tipo,
      descripcion: descripcion ? descripcion.trim() : '',
      reporterId: req.estudianteBDD ? req.estudianteBDD._id : (req.user?._id || null),
      archivos,
      meta: { publicacionId: publicacion._id, redId: publicacion.comunidadId || null }
    })

    const pop = await ReporteUnificado.findById(nuevo._id).populate('meta.publicacionId').populate('meta.redId', 'nombre')
    return res.status(201).json({ msg: 'Reporte creado', reporte: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Create report: red
const crearReporteRed = async (req, res) => {
  try {
    const { tipo, descripcion, redId, archivos = [] } = req.body
    const red = await RedComunitaria.findById(redId)
    if (!red) return res.status(404).json({ msg: 'Red comunitaria no encontrada' })

    const nuevo = await ReporteUnificado.create({
      subtype: 'red',
      tipo,
      descripcion: descripcion ? descripcion.trim() : '',
      reporterId: req.user?._id || null,
      archivos,
      meta: { redId }
    })

    const pop = await ReporteUnificado.findById(nuevo._id).populate('meta.redId', 'nombre').populate('reporterId', 'nombre apellido fotoPerfil email')
    return res.status(201).json({ msg: 'Reporte creado', reporte: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Create report: app
const crearReporteApp = async (req, res) => {
  try {
    const { tipo, descripcion, archivos = [] } = req.body
    const nuevo = await ReporteUnificado.create({
      subtype: 'app',
      tipo,
      descripcion: descripcion ? descripcion.trim() : '',
      reporterId: req.estudianteBDD ? req.estudianteBDD._id : (req.user?._id || null),
      archivos
    })
    const pop = await ReporteUnificado.findById(nuevo._id).populate('reporterId', 'nombre apellido fotoPerfil email')
    return res.status(201).json({ msg: 'Reporte creado', reporte: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Create report: usuario
const crearReporteUsuario = async (req, res) => {
  try {
    const { tipo, descripcion, reportadoUsuarioId, archivos = [] } = req.body
    const usuario = await Estudiante.findById(reportadoUsuarioId)
    if (!usuario) return res.status(404).json({ msg: 'Usuario reportado no encontrado' })

    const nuevo = await ReporteUnificado.create({
      subtype: 'usuario',
      tipo,
      descripcion: descripcion ? descripcion.trim() : '',
      reporterId: req.estudianteBDD ? req.estudianteBDD._id : (req.user?._id || null),
      archivos,
      meta: { reportadoUsuarioId }
    })

    const pop = await ReporteUnificado.findById(nuevo._id).populate('meta.reportadoUsuarioId', 'nombre apellido fotoPerfil email').populate('reporterId', 'nombre apellido fotoPerfil email')
    return res.status(201).json({ msg: 'Reporte creado', reporte: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// List helpers
const listarReportesPorSubtype = (subtype, populate = []) => {
  const q = ReporteUnificado.find({ subtype }).sort({ createdAt: -1 }).populate('reporterId', 'nombre apellido fotoPerfil email')
  populate.forEach(p => { q.populate(p) })
  return q
}

const listarReportesUsuarios = async (req, res) => {
  try {
    const q = listarReportesPorSubtype('usuario', [{ path: 'meta.reportadoUsuarioId', select: 'nombre apellido fotoPerfil email' }])
    const reportes = await q.exec()
    return res.status(200).json({ reportes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarReportesRedes = async (req, res) => {
  try {
    const q = listarReportesPorSubtype('red', ['meta.redId'])
    const reportes = await q.exec()
    return res.status(200).json({ reportes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarReportesApp = async (req, res) => {
  try {
    const q = listarReportesPorSubtype('app')
    const reportes = await q.exec()
    return res.status(200).json({ reportes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Resolve report: usuario
const resolverReporteUsuario = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, respuesta } = req.body
    const mapped = mapEstadoFromBody(estado)
    if (!mapped || !['resuelto','rechazado'].includes(mapped)) return res.status(400).json({ msg: 'Estado inválido. Solo se acepta "Resuelta" o "Rechazada"' })

    const reporte = await ReporteUnificado.findById(id)
    if (!reporte || reporte.subtype !== 'usuario') return res.status(404).json({ msg: 'Reporte de usuario no encontrado' })

    if (['resuelto','rechazado'].includes(reporte.estado)) return res.status(400).json({ msg: 'El reporte ya fue resuelto o rechazado' })

    if (mapped === 'rechazado') {
      reporte.estado = 'rechazado'
      if (respuesta) reporte.respuesta = respuesta
      await reporte.save()
      const reportePop = await ReporteUnificado.findById(reporte._id).populate('meta.reportadoUsuarioId', 'nombre apellido fotoPerfil email').populate('reporterId', 'nombre apellido fotoPerfil email')
      return res.status(200).json({ msg: 'Reporte rechazado', reporte: reportePop })
    }

    // Resuelto -> suspender usuario
    reporte.estado = 'resuelto'
    if (respuesta) reporte.respuesta = respuesta
    await reporte.save()

    const usuario = await Estudiante.findById(reporte.meta.reportadoUsuarioId)
    if (usuario) {
      usuario.suspendido = true
      await usuario.save()
    }

    const reportePop = await ReporteUnificado.findById(reporte._id).populate('meta.reportadoUsuarioId', 'nombre apellido fotoPerfil email').populate('reporterId', 'nombre apellido fotoPerfil email')
    return res.status(200).json({ msg: 'Reporte resuelto. Usuario suspendido', reporte: reportePop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Resolve report: red
const resolverReporteRed = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, respuesta } = req.body
    const mapped = mapEstadoFromBody(estado)
    if (!mapped || !['resuelto','rechazado'].includes(mapped)) return res.status(400).json({ msg: 'Estado inválido. Solo se acepta "Resuelta" o "Rechazada"' })

    const reporte = await ReporteUnificado.findById(id)
    if (!reporte || reporte.subtype !== 'red') return res.status(404).json({ msg: 'Reporte de red no encontrado' })

    if (['resuelto','rechazado'].includes(reporte.estado)) return res.status(400).json({ msg: 'El reporte ya fue resuelto o rechazado' })

    if (mapped === 'rechazado') {
      reporte.estado = 'rechazado'
      if (respuesta) reporte.respuesta = respuesta
      await reporte.save()
      const reportePop = await ReporteUnificado.findById(reporte._id).populate('meta.redId', 'nombre deshabilitada').populate('reporterId', 'nombre apellido fotoPerfil email')
      return res.status(200).json({ msg: 'Reporte rechazado', reporte: reportePop })
    }

    // Resuelto: deshabilitar la red
    reporte.estado = 'resuelto'
    if (respuesta) reporte.respuesta = respuesta
    await reporte.save()

    const red = await RedComunitaria.findById(reporte.meta.redId)
    if (!red) {
      const reportePop = await ReporteUnificado.findById(reporte._id).populate('meta.redId', 'nombre deshabilitada').populate('reporterId', 'nombre apellido fotoPerfil email')
      return res.status(200).json({ msg: 'Reporte resuelto. La red no existe', reporte: reportePop })
    }

    red.deshabilitada = true
    await red.save()

    const reportePop = await ReporteUnificado.findById(reporte._id).populate('meta.redId', 'nombre deshabilitada').populate('reporterId', 'nombre apellido fotoPerfil email')
    return res.status(200).json({ msg: 'Reporte resuelto. Red deshabilitada', reporte: reportePop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Resolve report: app
const resolverReporteApp = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, respuesta } = req.body
    const mapped = mapEstadoFromBody(estado)
    if (!mapped || !['resuelto','rechazado'].includes(mapped)) return res.status(400).json({ msg: 'Estado inválido. Solo se acepta "Resuelta" o "Rechazada"' })

    const reporte = await ReporteUnificado.findById(id)
    if (!reporte || reporte.subtype !== 'app') return res.status(404).json({ msg: 'Reporte de app no encontrado' })

    if (['resuelto','rechazado'].includes(reporte.estado)) return res.status(400).json({ msg: 'El reporte ya fue resuelto' })

    if (mapped === 'rechazado') {
      reporte.estado = 'rechazado'
      if (respuesta) reporte.respuesta = respuesta
      await reporte.save()
      const reportePop = await ReporteUnificado.findById(reporte._id).populate('reporterId', 'nombre apellido fotoPerfil email')
      return res.status(200).json({ msg: 'Reporte rechazado', reporte: reportePop })
    }

    reporte.estado = 'resuelto'
    if (respuesta) reporte.respuesta = respuesta
    await reporte.save()

    const reportePop = await ReporteUnificado.findById(reporte._id).populate('reporterId', 'nombre apellido fotoPerfil email')
    return res.status(200).json({ msg: 'Reporte de app resuelto', reporte: reportePop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Admin resolves publication report (only admin of red)
const resolverReportePublicacionAdmin = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, respuesta } = req.body
    const mapped = mapEstadoFromBody(estado)
    if (!mapped || !['resuelto','rechazado'].includes(mapped)) return res.status(400).json({ msg: 'Estado inválido. Solo se acepta "Resuelta" o "Rechazada"' })

    const reporte = await ReporteUnificado.findById(id)
    if (!reporte || reporte.subtype !== 'publicacion') return res.status(404).json({ msg: 'Reporte de publicación no encontrado' })

    if (reporte.estado === 'resuelto') return res.status(400).json({ msg: 'El reporte ya fue resuelto' })

    const admin = req.user
    if (!admin.redAsignada || !reporte.meta.redId || String(reporte.meta.redId) !== String(admin.redAsignada)) {
      return res.status(403).json({ msg: 'No estás autorizado para resolver este reporte' })
    }

    if (mapped === 'rechazado') {
      reporte.estado = 'rechazado'
      if (respuesta) reporte.respuesta = respuesta
      await reporte.save()
      const reportePop = await ReporteUnificado.findById(reporte._id).populate('meta.publicacionId').populate('meta.redId', 'nombre').populate('reporterId', 'nombre apellido fotoPerfil email')
      return res.status(200).json({ msg: 'Reporte rechazado', reporte: reportePop })
    }

    // Resuelto: eliminar publicación
    reporte.estado = 'resuelto'
    if (respuesta) reporte.respuesta = respuesta
    await reporte.save()

    const publicacion = await Publicacion.findById(reporte.meta.publicacionId)
    if (!publicacion) {
      const reportePop = await ReporteUnificado.findById(reporte._id).populate('meta.publicacionId').populate('meta.redId', 'nombre').populate('reporterId', 'nombre apellido fotoPerfil email')
      return res.status(200).json({ msg: 'Reporte resuelto. La publicación no existe (posible eliminación previa)', reporte: reportePop })
    }

    if (!publicacion.comunidadId || String(publicacion.comunidadId) !== String(admin.redAsignada)) {
      return res.status(403).json({ msg: 'No estás autorizado para eliminar la publicación' })
    }

    await Publicacion.findByIdAndDelete(publicacion._id)

    const reportePop = await ReporteUnificado.findById(reporte._id).populate('meta.publicacionId').populate('meta.redId', 'nombre').populate('reporterId', 'nombre apellido fotoPerfil email')
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
    const reportes = await ReporteUnificado.find({ subtype: 'publicacion', 'meta.redId': admin.redAsignada }).populate('meta.publicacionId').populate('reporterId', 'nombre apellido fotoPerfil email').sort({ createdAt: -1 })
    return res.status(200).json({ reportes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Deletions
const deleteReportePorId = async (req, res, subtype) => {
  try {
    const { id } = req.params
    const reporte = await ReporteUnificado.findById(id)
    if (!reporte || (subtype && reporte.subtype !== subtype)) return res.status(404).json({ msg: 'Reporte no encontrado' })
    await ReporteUnificado.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Reporte eliminado' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const deleteReporteUsuario = async (req, res) => deleteReportePorId(req, res, 'usuario')
const deleteReporteRed = async (req, res) => deleteReportePorId(req, res, 'red')
const deleteReporteApp = async (req, res) => deleteReportePorId(req, res, 'app')
const deleteReportePublicacionAdmin = async (req, res) => deleteReportePorId(req, res, 'publicacion')

// Solicitudes: crear verificacion
const crearSolicitudVerificacion = async (req, res) => {
  try {
    const solicitanteId = req.user?._id
    const { redId, descripcion, solicitarVerificada = false, solicitarOficial = false } = req.body

    // Presence/format validation for `redId` and `descripcion` is handled by route validators.

    const red = await RedComunitaria.findById(redId)
    if (!red) return res.status(404).json({ msg: 'Red no encontrada' })

    const adminRelation = await AdminRed.findOne({ usuarioId: solicitanteId, redId: redId, estado: 'activo' })
    const esCreador = red.creadaPor && red.creadaPor.equals(solicitanteId)
    if (!adminRelation && !esCreador) return res.status(403).json({ msg: 'Solo el admin asignado de la red puede solicitar verificación/oficialización' })

    if (!solicitarVerificada && !solicitarOficial) return res.status(400).json({ msg: 'Debes solicitar al menos "verificada" o "oficial"' })

    const nueva = await SolicitudUnificada.create({
      subtype: 'verificacion',
      solicitante: solicitanteId,
      descripcion: descripcion.trim(),
      meta: { redId, solicitarVerificada: Boolean(solicitarVerificada), solicitarOficial: Boolean(solicitarOficial) }
    })

    const pop = await SolicitudUnificada.findById(nueva._id).populate('meta.redId', 'nombre').populate('solicitante', 'nombre apellido fotoPerfil email')
    return res.status(201).json({ msg: 'Solicitud creada', solicitud: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Crear solicitud rehabilitar
const crearSolicitudRehabilitar = async (req, res) => {
  try {
    const solicitanteId = req.user?._id
    const { redId, descripcion } = req.body
    // Presence/format validation for `redId` and `descripcion` is handled by route validators.
    const red = await RedComunitaria.findById(redId)
    if (!red) return res.status(404).json({ msg: 'Red no encontrada' })
    const adminRelation = await AdminRed.findOne({ usuarioId: solicitanteId, redId: redId, estado: 'activo' })
    const esCreador = red.creadaPor && red.creadaPor.equals(solicitanteId)
    if (!adminRelation && !esCreador) return res.status(403).json({ msg: 'Solo el admin asignado de la red puede solicitar rehabilitación' })
    if (!red.deshabilitada) return res.status(400).json({ msg: 'La red no está deshabilitada' })
    const existePendiente = await SolicitudUnificada.findOne({ subtype: 'rehabilitar_red', 'meta.redId': redId, solicitante: solicitanteId, estado: 'pendiente' })
    if (existePendiente) return res.status(400).json({ msg: 'Ya existe una solicitud pendiente para esta red' })
    const nueva = await SolicitudUnificada.create({ subtype: 'rehabilitar_red', solicitante: solicitanteId, descripcion: descripcion.trim(), meta: { redId } })
    const pop = await SolicitudUnificada.findById(nueva._id).populate('meta.redId', 'nombre deshabilitada').populate('solicitante', 'nombre apellido fotoPerfil email')
    return res.status(201).json({ msg: 'Solicitud creada', solicitud: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Crear solicitud habilitar usuario
const crearSolicitudHabilitarUsuario = async (req, res) => {
  try {
    let solicitanteId = req.user?._id
    const { motivo, email, username } = req.body
    // Presence/format validation for `motivo` and (email|username) is handled by route validators.
    let estudiante = null
    if (solicitanteId) {
      estudiante = await Estudiante.findById(solicitanteId).select('-password')
    } else {
      if (email) estudiante = await Estudiante.findOne({ email: String(email).toLowerCase() }).select('-password')
      else if (username) estudiante = await Estudiante.findOne({ username: String(username).trim() }).select('-password')
    }
    if (!estudiante) return res.status(404).json({ msg: 'Usuario no encontrado' })
    if (!estudiante.suspendido) return res.status(400).json({ msg: 'El usuario no está suspendido' })
    const existePendiente = await SolicitudUnificada.findOne({ subtype: 'habilitar_usuario', solicitante: solicitanteId, estado: 'pendiente' })
    if (existePendiente) return res.status(400).json({ msg: 'Ya existe una solicitud pendiente' })
    // ensure solicitanteId is set to the found student's id
    solicitanteId = solicitanteId || estudiante._id
    const nueva = await SolicitudUnificada.create({ subtype: 'habilitar_usuario', solicitante: solicitanteId, descripcion: motivo.trim(), meta: { motivo } })
    const pop = await SolicitudUnificada.findById(nueva._id).populate('solicitante', 'nombre apellido fotoPerfil email')
    return res.status(201).json({ msg: 'Solicitud creada', solicitud: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// List solicitudes
const listarSolicitudesVerificacion = async (req, res) => {
  try {
    const solicitudes = await SolicitudUnificada.find({ subtype: 'verificacion' }).populate('meta.redId', 'nombre').populate('solicitante', 'nombre apellido fotoPerfil email').sort({ createdAt: -1 })
    return res.status(200).json({ solicitudes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarSolicitudesRehabilitar = async (req, res) => {
  try {
    const solicitudes = await SolicitudUnificada.find({ subtype: 'rehabilitar_red' }).populate('meta.redId', 'nombre deshabilitada').populate('solicitante', 'nombre apellido fotoPerfil email').sort({ createdAt: -1 })
    return res.status(200).json({ solicitudes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarSolicitudesHabilitarUsuarios = async (req, res) => {
  try {
    const solicitudes = await SolicitudUnificada.find({ subtype: 'habilitar_usuario' }).populate('solicitante', 'nombre apellido fotoPerfil email suspendido').sort({ createdAt: -1 })
    return res.status(200).json({ solicitudes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// List own solicitudes
const listarMisSolicitudesRehabilitar = async (req, res) => {
  try {
    const adminId = req.user?._id
    const solicitudes = await SolicitudUnificada.find({ subtype: 'rehabilitar_red', solicitante: adminId }).populate('meta.redId', 'nombre deshabilitada').populate('solicitante', 'nombre apellido fotoPerfil email').sort({ createdAt: -1 })
    return res.status(200).json({ solicitudes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarMisSolicitudesVerificacion = async (req, res) => {
  try {
    const adminId = req.user?._id
    const solicitudes = await SolicitudUnificada.find({ subtype: 'verificacion', solicitante: adminId }).populate('meta.redId', 'nombre').populate('solicitante', 'nombre apellido fotoPerfil email').sort({ createdAt: -1 })
    return res.status(200).json({ solicitudes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Delete solicitudes
const deleteSolicitudRehabilitar = async (req, res) => {
  try {
    const { id } = req.params
    const sol = await SolicitudUnificada.findById(id)
    if (!sol || sol.subtype !== 'rehabilitar_red') return res.status(404).json({ msg: 'Solicitud no encontrada' })
    await SolicitudUnificada.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Solicitud eliminada' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const deleteSolicitudHabilitarUsuario = async (req, res) => {
  try {
    const { id } = req.params
    const sol = await SolicitudUnificada.findById(id)
    if (!sol || sol.subtype !== 'habilitar_usuario') return res.status(404).json({ msg: 'Solicitud no encontrada' })
    await SolicitudUnificada.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Solicitud eliminada' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const deleteSolicitudVerificacion = async (req, res) => {
  try {
    const { id } = req.params
    const sol = await SolicitudUnificada.findById(id)
    if (!sol || sol.subtype !== 'verificacion') return res.status(404).json({ msg: 'Solicitud no encontrada' })
    await SolicitudUnificada.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Solicitud eliminada' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const deleteSolicitudRehabilitarByAdmin = async (req, res) => {
  try {
    const { id } = req.params
    const adminId = req.user?._id
    const sol = await SolicitudUnificada.findById(id)
    if (!sol || sol.subtype !== 'rehabilitar_red') return res.status(404).json({ msg: 'Solicitud no encontrada' })
    if (String(sol.solicitante) !== String(adminId)) return res.status(403).json({ msg: 'No estás autorizado para eliminar esta solicitud' })
    await SolicitudUnificada.findByIdAndDelete(id)
    return res.status(200).json({ msg: 'Solicitud eliminada' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Resolve solicitud rehabilitar (superadmin)
const resolverSolicitudRehabilitar = async (req, res) => {
  try {
    const { id } = req.params
    const { accion, respuesta } = req.body
    if (!['Aprobar','Rechazar'].includes(accion)) return res.status(400).json({ msg: 'Acción inválida. Solo "Aprobar" o "Rechazar"' })
    const solicitud = await SolicitudUnificada.findById(id)
    if (!solicitud || solicitud.subtype !== 'rehabilitar_red') return res.status(404).json({ msg: 'Solicitud no encontrada' })
    if (solicitud.estado === 'aprobada') return res.status(400).json({ msg: 'La solicitud ya fue aprobada' })
    const red = await RedComunitaria.findById(solicitud.meta.redId)
    if (!red) return res.status(404).json({ msg: 'Red no encontrada' })
    if (accion === 'Rechazar') {
      solicitud.estado = 'rechazada'
      if (respuesta) solicitud.respuesta = respuesta
      await solicitud.save()
      const pop = await SolicitudUnificada.findById(solicitud._id).populate('meta.redId', 'nombre deshabilitada').populate('solicitante', 'nombre apellido fotoPerfil email')
      return res.status(200).json({ msg: 'Solicitud rechazada', solicitud: pop })
    }
    red.deshabilitada = false
    await red.save()
    solicitud.estado = 'aprobada'
    if (respuesta) solicitud.respuesta = respuesta
    await solicitud.save()
    const pop = await SolicitudUnificada.findById(solicitud._id).populate('meta.redId', 'nombre deshabilitada').populate('solicitante', 'nombre apellido fotoPerfil email')
    return res.status(200).json({ msg: 'Solicitud aprobada. Red reactivada', solicitud: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Resolve solicitud habilitar usuario (superadmin)
const resolverSolicitudHabilitarUsuario = async (req, res) => {
  try {
    const { id } = req.params
    const { accion, respuesta } = req.body
    if (!['Aprobar','Rechazar'].includes(accion)) return res.status(400).json({ msg: 'Acción inválida. Solo "Aprobar" o "Rechazar"' })
    const solicitud = await SolicitudUnificada.findById(id)
    if (!solicitud || solicitud.subtype !== 'habilitar_usuario') return res.status(404).json({ msg: 'Solicitud no encontrada' })
    if (solicitud.estado === 'aprobada') return res.status(400).json({ msg: 'La solicitud ya fue aprobada' })
    const estudiante = await Estudiante.findById(solicitud.solicitante)
    if (!estudiante) return res.status(404).json({ msg: 'Estudiante no encontrado' })
    if (accion === 'Rechazar') {
      solicitud.estado = 'rechazada'
      if (respuesta) solicitud.respuesta = respuesta
      await solicitud.save()
      const pop = await SolicitudUnificada.findById(solicitud._id).populate('solicitante', 'nombre apellido fotoPerfil email suspendido')
      return res.status(200).json({ msg: 'Solicitud rechazada', solicitud: pop })
    }
    estudiante.suspendido = false
    await estudiante.save()
    solicitud.estado = 'aprobada'
    if (respuesta) solicitud.respuesta = respuesta
    await solicitud.save()
    const pop = await SolicitudUnificada.findById(solicitud._id).populate('solicitante', 'nombre apellido fotoPerfil email suspendido')
    return res.status(200).json({ msg: 'Solicitud aprobada. Usuario habilitado', solicitud: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

// Resolve solicitud verificacion (superadmin)
const resolverSolicitudVerificacion = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, asignarVerificada = false, asignarOficial = false, respuesta } = req.body
    if (!['Aprobada','Rechazada'].includes(estado)) return res.status(400).json({ msg: 'Estado inválido. Solo "Aprobada" o "Rechazada"' })
    const solicitud = await SolicitudUnificada.findById(id)
    if (!solicitud || solicitud.subtype !== 'verificacion') return res.status(404).json({ msg: 'Solicitud no encontrada' })
    if (solicitud.estado === 'aprobada') return res.status(400).json({ msg: 'La solicitud ya fue aprobada' })
    if (estado === 'Rechazada') {
      solicitud.estado = 'rechazada'
      if (respuesta) solicitud.respuesta = respuesta
      await solicitud.save()
      const pop = await SolicitudUnificada.findById(solicitud._id).populate('meta.redId', 'nombre').populate('solicitante', 'nombre apellido fotoPerfil email').select('-__v')
      return res.status(200).json({ msg: 'Solicitud rechazada', solicitud: pop })
    }
    const red = await RedComunitaria.findById(solicitud.meta.redId)
    if (!red) return res.status(404).json({ msg: 'Red no encontrada' })
    if (Boolean(asignarVerificada)) red.esVerificada = true
    if (Boolean(asignarOficial)) red.esOficial = true
    await red.save()
    solicitud.estado = 'aprobada'
    if (respuesta) solicitud.respuesta = respuesta
    await solicitud.save()
    const pop = await SolicitudUnificada.findById(solicitud._id).populate('meta.redId', 'nombre esVerificada esOficial').populate('solicitante', 'nombre apellido fotoPerfil email').select('-__v')
    return res.status(200).json({ msg: 'Solicitud aprobada', solicitud: pop })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

export {
  crearReportePublicacion,
  crearReporteRed,
  crearReporteApp,
  crearReporteUsuario,
  listarReportesUsuarios,
  listarReportesRedes,
  listarReportesApp,
  resolverReporteUsuario,
  resolverReporteRed,
  resolverReporteApp,
  resolverReportePublicacionAdmin,
  listarReportesAdminRed,
  crearSolicitudVerificacion,
  listarSolicitudesVerificacion,
  resolverSolicitudVerificacion,
  crearSolicitudRehabilitar,
  listarSolicitudesRehabilitar,
  resolverSolicitudRehabilitar,
  crearSolicitudHabilitarUsuario,
  listarSolicitudesHabilitarUsuarios,
  resolverSolicitudHabilitarUsuario,
  deleteReporteUsuario,
  deleteReporteRed,
  deleteReporteApp,
  deleteReportePublicacionAdmin,
  deleteSolicitudRehabilitar,
  deleteSolicitudHabilitarUsuario,
  deleteSolicitudVerificacion,
  deleteSolicitudRehabilitarByAdmin,
  listarMisSolicitudesRehabilitar,
  listarMisSolicitudesVerificacion
}
