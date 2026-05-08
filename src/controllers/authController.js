import Estudiante from '../models/Estudiantes.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

export const signToken = (user, context = 'mobile') => {
  const payload = { id: user._id, roles: user.roles, context }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' })
}

export const login = async (req, res) => {
  try {
    const { email, password, context = 'mobile' } = req.body
    if (!email || !password) return res.status(400).json({ msg: 'Email y password requeridos' })

    const user = await Estudiante.findOne({ email })
    if (!user) return res.status(404).json({ msg: 'Usuario no registrado' })

    const match = await bcrypt.compare(password, user.password || '')
    if (!match) return res.status(401).json({ msg: 'Contraseña incorrecta' })

    // Si se solicita context admin_panel, verificar rol
    if (context === 'admin_panel' && !user.roles.includes('admin_red')) {
      return res.status(403).json({ msg: 'Usuario no autorizado para panel administrativo' })
    }

    const token = signToken(user, context)

    return res.status(200).json({
      token,
      user: {
        _id: user._id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        roles: user.roles
      }
    })
  } catch (error) {
    console.error('Error en authController.login:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

export default { login }
