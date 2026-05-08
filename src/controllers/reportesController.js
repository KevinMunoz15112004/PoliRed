import Reporte from '../models/Reportes.js'
import RedComunitaria from '../models/RedComunitaria.js'

const crearReporte = async (req, res) => {
  try {
    const { tipo = 'otro', descripcion, redId, archivos = [] } = req.body

    if (!descripcion || !descripcion.trim()) {
      return res.status(400).json({ msg: 'Debes enviar una descripción' })
    }

    const nuevoReporte = await Reporte.create({
      tipo,
      descripcion: descripcion.trim(),
      usuarioId: req.estudianteBDD ? req.estudianteBDD._id : null,
      redId: redId || null,
      archivos
    })

    return res.status(201).json({ msg: 'Reporte creado', reporte: nuevoReporte })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarReportesSuperAdmin = async (req, res) => {
  try {
    const reportes = await Reporte.find().populate('usuarioId', 'nombre apellido email').populate('redId', 'nombre').sort({ createdAt: -1 })
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

    const reporte = await Reporte.findById(id)
    if (!reporte) return res.status(404).json({ msg: 'Reporte no encontrado' })

    reporte.estado = estado
    if (respuesta) reporte.respuesta = respuesta
    await reporte.save()

    return res.status(200).json({ msg: 'Reporte actualizado', reporte })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarReportesAdminRed = async (req, res) => {
  try {
    const admin = req.user
    if (!admin.redAsignada) return res.status(400).json({ msg: 'No tienes red asignada' })

    const reportes = await Reporte.find({ redId: admin.redAsignada }).populate('usuarioId', 'nombre apellido email').sort({ createdAt: -1 })
    return res.status(200).json({ reportes })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

export { crearReporte, listarReportesSuperAdmin, resolverReporte, listarReportesAdminRed }
