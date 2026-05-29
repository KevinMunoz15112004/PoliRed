import jwt from 'jsonwebtoken'
import Estudiante from '../models/Estudiantes.js'
import AdminRed from '../models/adminRedes.js'

export async function verifyToken(req, res, next) {
  
  let auth = req.headers.authorization
  
  // Fallback: leer token desde query params (para Pusher auth en Android)
  if (!auth && req.query.token) {
    auth = `Bearer ${req.query.token}`
  }
  // Fallback: leer token desde body (para Pusher auth)
  if (!auth && req.body && req.body.token) {
    auth = `Bearer ${req.body.token}`
  }

  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ msg: 'Token no proporcionado' })
  const token = auth.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await Estudiante.findById(payload.id).select('-password').lean()
    if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' })
    req.user = user
    req.tokenPayload = payload
    // si el usuario tiene rol admin_red, cargar relaciones adminRed
    if (Array.isArray(user.roles) && user.roles.includes('admin_red')) {
      try {
        const relaciones = await AdminRed.find({ usuarioId: user._id }).lean()
        req.adminRelations = relaciones
        // establecer redAsignada en req.user si hay una relación activa
        const activa = relaciones.find(r => r.estado === 'activo')
        if (activa) req.user.redAsignada = activa.redId
      } catch (e) {
        console.error('Error cargando relaciones AdminRed:', e)
        req.adminRelations = []
      }
    }
    next()
  } catch (err) {
    return res.status(401).json({ msg: 'Token inválido' })
  }
}

export async function optionalVerifyToken(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return next()
  const token = auth.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await Estudiante.findById(payload.id).select('-password').lean()
    if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' })
    req.user = user
    req.tokenPayload = payload
    if (Array.isArray(user.roles) && user.roles.includes('admin_red')) {
      try {
        const relaciones = await AdminRed.find({ usuarioId: user._id }).lean()
        req.adminRelations = relaciones
        const activa = relaciones.find(r => r.estado === 'activo')
        if (activa) req.user.redAsignada = activa.redId
      } catch (e) {
        console.error('Error cargando relaciones AdminRed:', e)
        req.adminRelations = []
      }
    }
    return next()
  } catch (err) {
    return res.status(401).json({ msg: 'Token inválido' })
  }
}

export function requireRole(role) {
  return async (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.roles) || !req.user.roles.includes(role)) {
      return res.status(403).json({ msg: 'No tienes el rol requerido' })
    }
    // Si rol es admin_red y aun no tenemos relaciones cargadas, intentar cargarlas
    if (role === 'admin_red' && !req.adminRelations) {
      try {
        const relaciones = await AdminRed.find({ usuarioId: req.user._id }).lean()
        req.adminRelations = relaciones
        const activa = relaciones.find(r => r.estado === 'activo')
        if (activa) req.user.redAsignada = activa.redId
      } catch (e) {
        console.error('Error cargando relaciones AdminRed en requireRole:', e)
        req.adminRelations = []
      }
    }
    next()
  }
}

export function requireContext(allowedContexts = []) {
  return (req, res, next) => {
    const context = req.tokenPayload && req.tokenPayload.context
    if (!context || !allowedContexts.includes(context)) {
      return res.status(403).json({ msg: 'Contexto no permitido' })
    }
    next()
  }
}
