import Estudiante from '../models/Estudiantes.js'
import mongoose from "mongoose"
import AdminRed from '../models/adminRedes.js'
import { Articulo } from '../models/Articulos.js'
import { sendMailToRegister, sendMailToRecoveryPasswordE } from '../config/nodemailer.js'
import SuperAdmin from '../models/SuperAdmin.js'
import Publicacion from "../models/Publicaciones.js"
import RedComunitaria from '../models/RedComunitaria.js'
import { Stripe } from "stripe"

const stripe = new Stripe(`${process.env.STRIPE_SECRET_KEY}`)

// NOTE: login functionality moved to /api/auth/login (authController)

const registroEstudiante = async (req, res) => {
  try {
    const { nombre, apellido, email, password, redComunitaria, usuario } = req.body

    if ([nombre, apellido, email, password].some(campo => !campo)) {
      return res.status(400).json({ msg: "Lo sentimos, debes llenar todos los campos obligatorios" })
    }

    const regexSoloLetras = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/

    if (!regexSoloLetras.test(nombre.trim())) {
      return res.status(400).json({ msg: "El nombre no debe contener números ni caracteres especiales" })
    }

    if (!regexSoloLetras.test(apellido.trim())) {
      return res.status(400).json({ msg: "El apellido no debe contener números ni caracteres especiales" })
    }

    // Nota: el campo `celular` fue eliminado del modelo; ya no se valida ni se guarda.

    const verificarEmailBDD = await Estudiante.findOne({ email })
    if (verificarEmailBDD) {
      return res.status(400).json({ msg: "Lo sentimos, el email ya se encuentra registrado" })
    }

    // username (usuario) debe existir y ser único
    if (!usuario || !usuario.trim()) {
      return res.status(400).json({ msg: "Lo sentimos, debes proporcionar un usuario" })
    }

    const existeUsuario = await Estudiante.findOne({ usuario: usuario.trim() })
    if (existeUsuario) {
      return res.status(400).json({ msg: "Lo sentimos, el usuario ya se encuentra registrado" })
    }

    const verificarEmailSA = await SuperAdmin.findOne({ email })
    if (verificarEmailSA) {
      return res.status(400).json({ msg: "Lo sentimos, el email ya pertenece al Super Administrador" })
    }

    // Asignar redes globales automáticamente
    const redesGlobales = await RedComunitaria.find({ esGlobal: true }).select('_id')
    const redesGlobalIds = redesGlobales.map(r => r._id.toString())

    const solicitadoRedes = Array.isArray(redComunitaria) ? redComunitaria : (redComunitaria ? [redComunitaria] : [])
    const combinado = Array.from(new Set([...solicitadoRedes.map(String), ...redesGlobalIds]))

    const nuevoEstudiante = new Estudiante({
      nombre,
      apellido,
      usuario: usuario.trim(),
      username: usuario.trim(),
      email,
      password,
      redComunitaria: combinado,
      roles: ['estudiante']
    })

    nuevoEstudiante.password = await nuevoEstudiante.encrypPassword(password)
    const token = nuevoEstudiante.crearToken()

    await nuevoEstudiante.save();

    // Agregar al listado de miembros de las redes asignadas (incluyendo globales)
    for (const redId of nuevoEstudiante.redComunitaria) {
      try {
        const red = await RedComunitaria.findById(redId)
        if (red && !red.miembros.includes(nuevoEstudiante._id)) {
          red.miembros.push(nuevoEstudiante._id)
          red.cantidadMiembros = red.miembros.length
          await red.save()
        }
      } catch (err) {
        console.error('Error actualizando miembros de la red:', err)
      }
    }

    await sendMailToRegister(email, token)

    return res.status(201).json({
      msg: "Revisa tu correo electrónico para confirmar tu cuenta",
      estudiante: {
        id: nuevoEstudiante._id,
        nombre: nuevoEstudiante.nombre,
        apellido: nuevoEstudiante.apellido,
        email: nuevoEstudiante.email,
        roles: nuevoEstudiante.roles,
        redComunitaria: nuevoEstudiante.redComunitaria
      }
    })

  } catch (error) {
    console.error("Error al registrar estudiante:", error)
    if (!res.headersSent) {
      return res.status(500).json({ msg: "Error en el servidor" })
    }
  }
}

const confirmarMailEstudiante = async (req, res) => {
  const token = req.params.token

  const estudianteBDD = await Estudiante.findOne({ token })

  if (!estudianteBDD) {
    return res.status(404).json({ msg: "Token inválido" })
  }

  if (!estudianteBDD.token) {
    return res.status(400).json({ msg: "La cuenta ya ha sido confirmada previamente" })
  }

  estudianteBDD.token = null
  estudianteBDD.confirmEmail = true

  await estudianteBDD.save();

  return res.status(200).json({ msg: "Correo confirmado, ya puedes iniciar sesión" })
}

const recuperarPasswordEstudiante = async (req, res) => {
  const { email } = req.body

  if (Object.values(req.body).includes("")) {
    return res.status(400).json({ msg: "Lo sentimos, debes llenar todos los campos" })
  }

  const estudianteBDD = await Estudiante.findOne({ email })

  if (estudianteBDD.authMicrosoft) {
    return res.status(400).json({ msg: "Este usuario inició sesión con Microsoft y no tiene contraseña" })
  }

  if (!estudianteBDD) {
    return res.status(404).json({ msg: "Lo sentimos, el usuario no se encuentra registrado" })
  }

  const token = estudianteBDD.crearToken()
  estudianteBDD.token = token

  await sendMailToRecoveryPasswordE(email, token)
  await estudianteBDD.save()

  return res.status(200).json({ msg: "Revisa tu correo electrónico para reestablecer tu cuenta" })
}

const comprobarTokenPasswordEstudiante = async (req, res) => {
  const { token } = req.params

  const estudianteBDD = await Estudiante.findOne({ token })

  if (estudianteBDD.authMicrosoft) {
    return res.status(400).json({ msg: "Este usuario inició sesión con Microsoft y no tiene contraseña" })
  }

  if (!estudianteBDD || estudianteBDD.token !== token) {
    return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" })
  }

  return res.status(200).json({ msg: "Token confirmado, ya puedes crear tu nuevo password" })
}

const crearNuevoPasswordEstudiante = async (req, res) => {
  const { password, confirmpassword } = req.body

  if ([password, confirmpassword].includes("")) {
    return res.status(400).json({ msg: "Lo sentimos, debes llenar todos los campos" })
  }

  if (password !== confirmpassword) {
    return res.status(400).json({ msg: "Lo sentimos, los passwords no coinciden" })
  }

  const estudianteBDD = await Estudiante.findOne({ token: req.params.token })

  if (estudianteBDD.authMicrosoft) {
    return res.status(400).json({ msg: "Este usuario inició sesión con Microsoft y no tiene contraseña" })
  }

  if (!estudianteBDD || estudianteBDD.token !== req.params.token) {
    return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" })
  }

  estudianteBDD.token = null
  estudianteBDD.password = await estudianteBDD.encrypPassword(password)

  await estudianteBDD.save()

  const correoAdmin = estudianteBDD.email
  const admin = await AdminRed.findOne({ email: correoAdmin })

  if (admin && !admin.authMicrosoft) {
    admin.password = await admin.encrypPassword(password)
    await admin.save();
  }

  return res.status(200).json({ msg: "Felicitaciones, ya puedes iniciar sesión con tu nuevo password" })
}

const perfilEstudiante = (req, res) => {
  if (req.user) {
    delete req.user.token
    delete req.user.confirmEmail
    delete req.user.createdAt
    delete req.user.updatedAt
    delete req.user.__v
    return res.status(200).json(req.user)
  }
  return res.status(401).json({ msg: 'Usuario no autenticado' })
}

const actualizarPerfilEstudiante = async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, email, redComunitaria } = req.body

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ msg: "Lo sentimos, debe ser un ID válido" })
  }

  const tieneDatos = Object.values(req.body).some(valor => valor && valor.trim() !== "")
  if (!tieneDatos) {
    return res.status(400).json({ msg: "Lo sentimos, debes llenar al menos un campo para actualizar" })
  }

  if (nombre !== undefined) {
    const nombreRegex = /^[a-zA-ZÀ-ÿ\s]+$/;
    if (!nombreRegex.test(nombre.trim())) {
      return res.status(400).json({ msg: "El nombre sólo debe contener letras y espacios" });
    }
  }

  if (apellido !== undefined) {
    const apellidoRegex = /^[a-zA-ZÀ-ÿ\s]+$/;
    if (!apellidoRegex.test(apellido.trim())) {
      return res.status(400).json({ msg: "El apellido sólo debe contener letras y espacios" });
    }
  }

  if (email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ msg: "El email no es válido" });
    }
  }


  const estudianteBDD = await Estudiante.findById(id)
  if (!estudianteBDD) {
    return res.status(404).json({ msg: `Lo sentimos, no existe el estudiante ${id}` })
  }

  if (email && email !== estudianteBDD.email) {
    const estudianteBDDMail = await Estudiante.findOne({ email })
    if (estudianteBDDMail) {
      return res.status(400).json({ msg: "Lo sentimos, el email ya se encuentra registrado" })
    }
    estudianteBDD.email = email
  }

  if (nombre) estudianteBDD.nombre = nombre
  if (apellido) estudianteBDD.apellido = apellido
  if (redComunitaria) {
    // No permitir remover redes globales: siempre mantenerlas
    const redesGlobales = await RedComunitaria.find({ esGlobal: true }).select('_id')
    const redesGlobalIds = redesGlobales.map(r => r._id.toString())

    const solicitado = Array.isArray(redComunitaria) ? redComunitaria.map(String) : [String(redComunitaria)]
    const combinado = Array.from(new Set([...solicitado, ...redesGlobalIds]))
    estudianteBDD.redComunitaria = combinado
  }

  await estudianteBDD.save()

  res.status(200).json({
    msg: "Perfil actualizado correctamente",
    estudiante: {
      id: estudianteBDD._id,
      nombre: estudianteBDD.nombre,
      apellido: estudianteBDD.apellido,
      email: estudianteBDD.email,
      redComunitaria: estudianteBDD.redComunitaria
    }
  })
}

const actualizarPasswordEstudiante = async (req, res) => {
  const estudianteBDD = await Estudiante.findById(req.user?._id)

  if (!estudianteBDD) {
    return res.status(404).json({ msg: "Lo sentimos, no existe el estudiante" })
  }

  if (!req.body.passwordactual || !req.body.passwordnuevo) {
    return res.status(400).json({ msg: "Lo sentimos, debes llenar todos los campos" })
  }

  const verificarPassword = await estudianteBDD.matchPassword(req.body.passwordactual)

  if (!verificarPassword) {
    return res.status(400).json({ msg: "Lo sentimos, la contraseña actual no es correcta" })
  }

  estudianteBDD.password = await estudianteBDD.encrypPassword(req.body.passwordnuevo)
  await estudianteBDD.save()

  res.status(200).json({ msg: "Contraseña actualizada correctamente" })
}

const obtenerRedesComunitarias = async (req, res) => {
  try {
    // Excluir redes globales del listado general
    const redes = await RedComunitaria.find({ esGlobal: { $ne: true } }, 'nombre descripcion cantidadMiembros esOficial esVerificada')
    res.status(200).json(redes)
  } catch (error) {
    console.error('Error al obtener redes comunitarias:', error)
    res.status(500).json({ msg: 'Error del servidor' })
  }
}

const obtenerRedesExplorar = async (req, res) => {
  try {
    // Solo redes marcadas como globales
    const redes = await RedComunitaria.find({ esGlobal: true }).select('nombre descripcion cantidadMiembros esOficial esVerificada cuentaGestion')
    res.status(200).json(redes)
  } catch (error) {
    console.error('Error al obtener redes para explorar:', error)
    res.status(500).json({ msg: 'Error del servidor' })
  }
}

const unirseARedComunitaria = async (req, res) => {
  const estudianteId = req.user?._id
  const { redId } = req.body

  if (!redId) {
    return res.status(400).json({ msg: 'Debes enviar el id de la red comunitaria' })
  }

  try {
    const red = await RedComunitaria.findById(redId)
    if (!red) {
      return res.status(404).json({ msg: 'La red comunitaria no existe' })
    }

    const estudiante = await Estudiante.findById(estudianteId)
    if (!estudiante) {
      return res.status(404).json({ msg: 'Estudiante no encontrado' })
    }

    if (estudiante.redComunitaria.some(r => r.equals(red._id))) {
      return res.status(400).json({ msg: "Ya perteneces a esta red comunitaria" })
    }

    estudiante.redComunitaria.push(red._id)
    await estudiante.save()

    red.miembros.push(estudiante._id)
    red.cantidadMiembros = red.miembros.length
    await red.save()

    res.status(200).json({
      msg: 'Te has unido exitosamente a la red comunitaria',
      red: {
        id: red._id,
        nombre: red.nombre,
        descripcion: red.descripcion
      }
    })
  } catch (error) {
    console.error('Error al unirse a la red:', error)
    res.status(500).json({ msg: 'Error del servidor' })
  }
}


const listarRedesDelEstudiante = async (req, res) => {
  try {
    const estudianteId = req.user?._id

    const estudiante = await Estudiante.findById(estudianteId)
      .populate('redComunitaria', 'nombre descripcion')

    if (!estudiante) {
      return res.status(404).json({ msg: "Estudiante no encontrado" })
    }

    res.status(200).json({ redes: estudiante.redComunitaria })
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: "Error del servidor" })
  }
}

const crearPublicacion = async (req, res) => {
  try {
    const { titulo, contenido, comunidadId } = req.body
    const estudianteId = req.user?._id

    let targetComunidadId = comunidadId

    // Si no se envía comunidadId, usar la red global por defecto
    let redGlobal = null
    if (!targetComunidadId) {
      redGlobal = await RedComunitaria.findOne({ esGlobal: true })
      if (!redGlobal) return res.status(500).json({ msg: 'No hay red global configurada' })
      targetComunidadId = redGlobal._id.toString()
    } else {
      if (!mongoose.Types.ObjectId.isValid(targetComunidadId)) {
        return res.status(400).json({ msg: "ID de comunidad no válido" })
      }
    }

    const estudianteBDD = await Estudiante.findById(estudianteId)
    if (!estudianteBDD) {
      return res.status(404).json({ msg: "Estudiante no encontrado" })
    }

    if (!titulo || !contenido) {
      return res.status(400).json({ msg: "Lo sentimos, debes llenar todos los campos" })
    }

    const maxPalabrasTitulo = 10
    const palabrasTitulo = titulo.trim().split(/\s+/)
    if (palabrasTitulo.length > maxPalabrasTitulo) {
      return res.status(400).json({ msg: `El título no debe exceder de ${maxPalabrasTitulo} palabras` })
    }

    // Obtener doc de la red objetivo para determinar si es global
    const redDoc = await RedComunitaria.findById(targetComunidadId)
    if (!redDoc) return res.status(404).json({ msg: 'Red comunitaria no encontrada' })

    const pertenece = estudianteBDD.redComunitaria && estudianteBDD.redComunitaria.some(r => r.equals(targetComunidadId))
    const esGlobalTarget = Boolean(redDoc.esGlobal)

    if (!pertenece) {
      if (esGlobalTarget) {
        try {
          estudianteBDD.redComunitaria = estudianteBDD.redComunitaria || []
          estudianteBDD.redComunitaria.push(redDoc._id)
          await estudianteBDD.save()

          if (!redDoc.miembros.includes(estudianteBDD._id)) {
            redDoc.miembros.push(estudianteBDD._id)
            redDoc.cantidadMiembros = redDoc.miembros.length
            await redDoc.save()
          }
        } catch (err) {
          console.error('Error añadiendo estudiante a red global:', err)
        }
      } else {
        return res.status(403).json({ msg: "No perteneces a esta red comunitaria" })
      }
    }

    const nuevaPublicacion = new Publicacion({
      autorId: estudianteId,
      comunidadId: targetComunidadId,
      titulo,
      contenido
    })

    await nuevaPublicacion.save()

    return res.status(201).json({
      msg: "Publicación creada correctamente",
      publicacion: nuevaPublicacion
    })
  } catch (error) {
    console.error("Error al crear publicación:", error)
    return res.status(500).json({ msg: "Error en el servidor" })
  }
}

const actualizarPublicacion = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id
    const { titulo, contenido } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: 'ID de publicación no válido' })
    }

    const publicacion = await Publicacion.findById(id)
    if (!publicacion) {
      return res.status(404).json({ msg: 'Publicación no encontrada' })
    }

    if (!publicacion.autorId.equals(estudianteId)) {
      return res.status(403).json({ msg: 'No tienes permiso para actualizar esta publicación' })
    }

    if (!titulo && !contenido) {
      return res.status(400).json({ msg: 'Debes enviar al menos un campo para actualizar' })
    }

    if (titulo) publicacion.titulo = titulo
    if (contenido) publicacion.contenido = contenido

    await publicacion.save()

    return res.status(200).json({ msg: 'Publicación actualizada correctamente', publicacion })
  } catch (error) {
    console.error('Error al actualizar publicación:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const eliminarPublicacion = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: 'ID de publicación no válido' })
    }

    const publicacion = await Publicacion.findById(id)
    if (!publicacion) {
      return res.status(404).json({ msg: 'Publicación no encontrada' })
    }

    if (!publicacion.autorId.equals(estudianteId)) {
      return res.status(403).json({ msg: 'No tienes permiso para eliminar esta publicación' })
    }

    await Publicacion.findByIdAndDelete(id)

    return res.status(200).json({ msg: 'Publicación eliminada correctamente' })
  } catch (error) {
    console.error('Error al eliminar publicación:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarPublicaciones = async (req, res) => {
  try {
    const publicaciones = await Publicacion.find()
      .populate('autorId', 'nombre apellido')
      .populate('comunidadId', 'nombre')
      .sort({ createdAt: -1 })

    res.status(200).json(publicaciones)
  } catch (error) {
    console.error('Error al listar publicaciones:', error)
    res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarPublicacionesPorRed = async (req, res) => {
  try {
    const { redId } = req.params

    if (!mongoose.Types.ObjectId.isValid(redId)) {
      return res.status(400).json({ msg: 'ID de red no válido' })
    }

    const redExiste = await RedComunitaria.findById(redId)
    if (!redExiste) {
      return res.status(404).json({ msg: 'Red comunitaria no encontrada' })
    }

    const publicaciones = await Publicacion.find({ comunidadId: redId })
      .populate('autorId', 'nombre apellido')
      .populate('comunidadId', 'nombre')
      .sort({ timestamp: -1 });

    return res.status(200).json({
      msg: publicaciones.length > 0
        ? 'Publicaciones encontradas'
        : 'Aún no hay publicaciones en esta red',
      publicaciones
    })
  } catch (error) {
    console.error('Error al listar publicaciones por red:', error)
    res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const publicarArticulo = async (req, res) => {
  try {
    const { titulo, descripcion, precio, comunidadId, imagen } = req.body
    const estudianteId = req.user?._id

    if (!mongoose.Types.ObjectId.isValid(comunidadId)) {
      return res.status(400).json({ msg: "ID de comunidad no válido" })
    }

    const estudianteBDD = await Estudiante.findById(estudianteId)
    if (!estudianteBDD) {
      return res.status(404).json({ msg: "Estudiante no encontrado" })
    }

    if (!titulo || !descripcion || !precio) {
      return res.status(400).json({ msg: "Debes completar todos los campos requeridos" })
    }

    const maxPalabrasTitulo = 10
    const palabrasTitulo = titulo.trim().split(/\s+/)
    if (palabrasTitulo.length > maxPalabrasTitulo) {
      return res.status(400).json({ msg: `El título no debe exceder de ${maxPalabrasTitulo} palabras` })
    }

    const precioStr = String(precio)

    const regexPrecio = /^\d+(\.\d+)?$/
    if (!regexPrecio.test(precioStr)) {
      return res.status(400).json({ msg: "El precio debe ser un número válido sin letras" })
    }

    const precioFloat = parseFloat(precio)
    if (isNaN(precioFloat) || precioFloat <= 0) {
      return res.status(400).json({ msg: "El precio debe ser un número válido mayor que 0" })
    }

    if (!estudianteBDD.redComunitaria || estudianteBDD.redComunitaria.length === 0) {
      return res.status(400).json({ msg: "Debes pertenecer a una red comunitaria para publicar un artículo" })
    }

    if (!estudianteBDD.redComunitaria.some(r => r.equals(comunidadId))) {
      return res.status(403).json({ msg: "No perteneces a esta red comunitaria" })
    }

    const nuevoArticulo = new Articulo({
      autorId: estudianteId,
      redComunitaria: comunidadId,
      titulo,
      descripcion,
      precio,
      imagen
    })

    await nuevoArticulo.save()

    return res.status(201).json({
      msg: "Artículo publicado correctamente",
      articulo: nuevoArticulo
    })
  } catch (error) {
    console.error("Error al publicar artículo:", error)
    return res.status(500).json({ msg: "Error interno del servidor" })
  }
}

const listarTodosArticulos = async (req, res) => {
  try {
    const articulos = await Articulo.find()
      .populate('autorId', 'nombre apellido')
      .populate('redComunitaria', 'nombre')
      .sort({ createdAt: -1 })

    return res.status(200).json({
      msg: articulos.length > 0
        ? 'Artículos encontrados'
        : 'No hay artículos publicados aún',
      articulos
    })
  } catch (error) {
    console.error('Error al listar todos los artículos:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarArticulosPorRed = async (req, res) => {
  try {
    const { redId } = req.params

    if (!mongoose.Types.ObjectId.isValid(redId)) {
      return res.status(400).json({ msg: 'ID de red no válido' })
    }

    const redExiste = await RedComunitaria.findById(redId)
    if (!redExiste) {
      return res.status(404).json({ msg: 'Red comunitaria no encontrada' })
    }

    const articulos = await Articulo.find({ redComunitaria: redId })
      .populate('autorId', 'nombre apellido')
      .populate('redComunitaria', 'nombre')
      .sort({ timestamp: -1 })

    return res.status(200).json({
      msg: articulos.length > 0
        ? 'Artículos encontrados'
        : 'Aún no hay artículos publicados en esta red',
      articulos
    })
  } catch (error) {
    console.error('Error al listar artículos por red:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const actualizarArticulo = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id
    const { titulo, descripcion, precio, imagen } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: 'ID de artículo no válido' })
    }

    const articulo = await Articulo.findById(id)
    if (!articulo) {
      return res.status(404).json({ msg: 'Artículo no encontrado' })
    }

    if (!articulo.autorId.equals(estudianteId)) {
      return res.status(403).json({ msg: 'No tienes permiso para actualizar este artículo' });
    }

    const maxPalabrasTitulo = 10
    const palabrasTitulo = titulo.trim().split(/\s+/)
    if (palabrasTitulo.length > maxPalabrasTitulo) {
      return res.status(400).json({ msg: `El título no debe exceder de ${maxPalabrasTitulo} palabras` })
    }

    if (!titulo && !descripcion && !precio && !imagen) {
      return res.status(400).json({ msg: 'Debes enviar al menos un campo para actualizar' });
    }

    if (titulo) articulo.titulo = titulo
    if (descripcion) articulo.descripcion = descripcion
    if (precio) articulo.precio = precio
    if (imagen) articulo.imagen = imagen

    await articulo.save()

    return res.status(200).json({ msg: 'Artículo actualizado correctamente', articulo })
  } catch (error) {
    console.error('Error al actualizar artículo:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const eliminarArticulo = async (req, res) => {
  try {
    const { id } = req.params
    const estudianteId = req.user?._id

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: 'ID de artículo no válido' })
    }

    const articulo = await Articulo.findById(id)
    if (!articulo) {
      return res.status(404).json({ msg: 'Artículo no encontrado' })
    }

    if (!articulo.autorId.equals(estudianteId)) {
      return res.status(403).json({ msg: 'No tienes permiso para eliminar este artículo' })
    }

    await Articulo.findByIdAndDelete(id)

    return res.status(200).json({ msg: 'Artículo eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar artículo:', error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const listarPublicacionesArticulos = async (req, res) => {
  try {
    const articulos = await Articulo.find()
      .populate('autorId', 'nombre apellido')
      .populate('redComunitaria', 'nombre descripcion')
      .sort({ createdAt: -1 })

    res.status(200).json(articulos)
  } catch (error) {
    console.error('Error al listar publicaciones de artículos:', error)
    res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const comprarArticulo = async (req, res) => {
  const { paymentMethodId, articuloId, compradorEmail, compradorNombre } = req.body

  try {
    const articulo = await Articulo.findById(articuloId).populate("autorId")
    if (!articulo) return res.status(404).json({ msg: "Artículo no encontrado" })
    if (articulo.vendido) return res.status(400).json({ msg: "Este artículo ya fue vendido" })
    if (!paymentMethodId) return res.status(400).json({ msg: "paymentMethodId no proporcionado" })

    let [cliente] = (await stripe.customers.list({ email: compradorEmail, limit: 1 })).data || []
    if (!cliente) {
      cliente = await stripe.customers.create({ name: compradorNombre, email: compradorEmail })
    }

    const payment = await stripe.paymentIntents.create({
      amount: Math.round(articulo.precio * 100),
      currency: "USD",
      description: `Compra del artículo: ${articulo.titulo}`,
      payment_method: paymentMethodId,
      confirm: true,
      customer: cliente.id,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never"
      }
    })

    if (payment.status === "succeeded") {
      articulo.vendido = true
      await articulo.save()

      return res.status(200).json({ msg: "Compra realizada exitosamente" })
    } else {
      return res.status(400).json({ msg: "El pago no fue completado" })
    }

  } catch (error) {
    console.error("Error al procesar la compra:", error)
    return res.status(500).json({ msg: "Error al intentar comprar el artículo", error })
  }
}

const obtenerEstudiantes = async (req, res) => {
  try {
    const estudiantes = await Estudiante.find({ status: true, rol: 'Estudiante' })
      .select('_id nombre apellido email');

    res.json(estudiantes);
  } catch (error) {
    console.error('Error al obtener estudiantes:', error);
    res.status(500).json({ msg: 'Error al obtener estudiantes' });
  }
}

export {
  registroEstudiante,
  confirmarMailEstudiante,
  recuperarPasswordEstudiante,
  comprobarTokenPasswordEstudiante,
  crearNuevoPasswordEstudiante,
  perfilEstudiante,
  actualizarPerfilEstudiante,
  actualizarPasswordEstudiante,
  obtenerRedesComunitarias,
  obtenerRedesExplorar,
  unirseARedComunitaria,
  listarRedesDelEstudiante,
  listarPublicacionesPorRed,
  crearPublicacion,
  actualizarPublicacion,
  eliminarPublicacion,
  listarPublicaciones,
  publicarArticulo,
  listarArticulosPorRed,
  listarTodosArticulos,
  actualizarArticulo,
  eliminarArticulo,
  listarPublicacionesArticulos,
  comprarArticulo,
  obtenerEstudiantes
}
