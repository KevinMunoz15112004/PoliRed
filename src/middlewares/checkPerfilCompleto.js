import Estudiante from '../models/Estudiantes.js'

export const requirePerfilCompleto = async (req, res, next) => {
  try {
    // verifyToken should have populated req.user
    const user = req.user
    if (!user) return res.status(401).json({ msg: 'Usuario no autenticado' })
    // If profile not complete, block certain actions
    if (!user.perfilCompleto) {
      return res.status(403).json({ msg: 'Debes completar tu perfil antes de usar esta funcionalidad' })
    }
    next()
  } catch (error) {
    console.error('Error en requirePerfilCompleto:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}
