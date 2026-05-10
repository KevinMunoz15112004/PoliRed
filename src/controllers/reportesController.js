import RedComunitaria from '../models/RedComunitaria.js'
import Publicacion from '../models/Publicaciones.js'
import ReportePublicacion from '../models/ReportePublicacion.js'
import ReporteUsuario from '../models/ReporteUsuario.js'
import ReporteApp from '../models/ReporteApp.js'

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

const listarReportesSuperAdmin = async (req, res) => {
  try {
    // Superadmin debe ver reportes generales de la app y reportes de usuarios (no los ligados a una red)
    const appReports = await ReporteApp.find().select('-reporterId')
    const userReports = await ReporteUsuario.find().populate('reportadoUsuarioId', 'nombre apellido email').select('-reporterId')

    const combined = [...appReports, ...userReports].sort((a, b) => b.createdAt - a.createdAt)
    return res.status(200).json({ reportes: combined })
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

const resolverReporte = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, respuesta } = req.body

    if (!['pendiente', 'en_progreso', 'resuelto'].includes(estado)) {
      return res.status(400).json({ msg: 'Estado inválido' })
    }

    // Buscar en las tres colecciones
    let reporte = await ReportePublicacion.findById(id)
    let tipoColeccion = 'publicacion'
    if (!reporte) {
      reporte = await ReporteUsuario.findById(id)
      tipoColeccion = reporte ? 'usuario' : tipoColeccion
    }
    if (!reporte) {
      reporte = await ReporteApp.findById(id)
      tipoColeccion = reporte ? 'app' : tipoColeccion
    }
    if (!reporte) return res.status(404).json({ msg: 'Reporte no encontrado' })

    reporte.estado = estado
    if (respuesta) reporte.respuesta = respuesta
    await reporte.save()

    // devolver versión poblada según colección, sin reporterId
    let reportePop
    if (tipoColeccion === 'publicacion') {
      reportePop = await ReportePublicacion.findById(reporte._id).populate('publicacionId').populate('redId', 'nombre').select('-reporterId')
    } else if (tipoColeccion === 'usuario') {
      reportePop = await ReporteUsuario.findById(reporte._id).populate('reportadoUsuarioId', 'nombre apellido email').select('-reporterId')
    } else {
      reportePop = await ReporteApp.findById(reporte._id).select('-reporterId')
    }

    return res.status(200).json({ msg: 'Reporte actualizado', reporte: reportePop })
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

export { crearReportePublicacion, crearReporteApp, crearReporteUsuario, listarReportesSuperAdmin, listarReportesApp, resolverReporte, listarReportesAdminRed }
