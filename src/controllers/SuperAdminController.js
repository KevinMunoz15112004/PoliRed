import SuperAdmin from '../models/SuperAdmin.js'
import mongoose from 'mongoose'
import Estudiante from '../models/Estudiantes.js'
import RedComunitaria from '../models/RedComunitaria.js'
import cloudinary from 'cloudinary'
import fs from "fs-extra"
import profileService from '../services/profileService.js'
import AdminRed from '../models/adminRedes.js'
import { sendMailToRecoveryPassword, sendMailToRegister, enviarCorreoNuevoAdmin } from "../config/nodemailer.js"
import { crearTokenJWT } from "../middlewares/authSuperAdmin.js"
// Validation is handled by centralized validators in src/validators/

//Controladores para la gestión de la cuenta
const login = async (req, res) => {
  // Request format validation moved to centralized validators (routes)

  try {
    const { email, password } = req.body

    const superAdminBDD = await SuperAdmin.findOne({ email })
      .select("-__v -token -updatedAt -createdAt")

    if (!superAdminBDD) {
      return res.status(404).json({ msg: "Lo sentimos, el usuario no se encuentra registrado" })
    }

    if (superAdminBDD.confirmEmail === false) {
      return res.status(403).json({ msg: "Lo sentimos, debe verificar su cuenta" })
    }

    const verificarPassword = await superAdminBDD.matchPassword(password)
    if (!verificarPassword) {
      return res.status(401).json({ msg: "Lo sentimos, la contraseña no es correcta" })
    }

    const { nombre, apellido, celular, _id, rol } = superAdminBDD
    const token = crearTokenJWT(superAdminBDD._id, superAdminBDD.rol)

    res.status(200).json({
      token,
      rol,
      nombre,
      apellido,
      celular,
      _id,
      email: superAdminBDD.email
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: "Error en el servidor" })
  }
}

const recuperarPassword = async (req, res) => {
  // Request format validation moved to centralized validators (routes)

  try {
    const { email } = req.body;

    const superAdminBDD = await SuperAdmin.findOne({ email })
    if (!superAdminBDD) {
      return res.status(404).json({ msg: "Lo sentimos, el usuario no se encuentra registrado" })
    }

    const token = superAdminBDD.crearToken()
    superAdminBDD.token = token

    await sendMailToRecoveryPassword(email, token)
    await superAdminBDD.save()

    res.status(200).json({ msg: "Revisa tu correo electrónico para reestablecer tu cuenta" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: "Error en el servidor" })
  }
}

const comprobarTokenPassword = async (req, res) => {
  // Token param validation is handled by centralized validators in routes

  try {
    const { token } = req.params

    const superAdminBDD = await SuperAdmin.findOne({ token })
    if (!superAdminBDD || superAdminBDD.token !== token) {
      return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" })
    }

    res.status(200).json({ msg: "Token confirmado, ya puedes crear tu nueva contraseña" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: "Error en el servidor" })
  }
}

const crearNuevoPassword = async (req, res) => {
  // Validation for passwords and token moved to centralized validators (routes)

  try {
    const { password, confirmpassword } = req.body  
    const { token } = req.params


    const superAdminBDD = await SuperAdmin.findOne({ token })
    if (!superAdminBDD || superAdminBDD.token !== token) {
      return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" })
    }

    superAdminBDD.token = null
    superAdminBDD.password = await superAdminBDD.encrypPassword(password)

    await superAdminBDD.save()

    res.status(200).json({ msg: "Felicitaciones, ya puedes iniciar sesión con tu nueva contraseña" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: "Error en el servidor" })
  }
}

const actualizarPerfil = async (req, res) => {
  // Request format validation moved to centralized validators (routes)

  try {
    const id = req.user._id;

    const campos = ["nombre", "apellido", "direccion", "celular", "email"]
    const datos = {};

    for (const campo of campos) {
      if (req.body[campo] && req.body[campo].trim() !== "") {
        datos[campo] = req.body[campo];
      }
    }

    if (Object.keys(datos).length === 0) {
      return res.status(400).json({ msg: "Lo sentimos, debes llenar al menos un campo a actualizar" })
    }

    const superAdminBDD = await SuperAdmin.findById(id);
    if (!superAdminBDD) {
      return res.status(404).json({ msg: `Lo sentimos, no existe el usuario` })
    }

    if (datos.email && superAdminBDD.email !== datos.email) {
      const existeEmail = await SuperAdmin.findOne({ email: datos.email })
      if (existeEmail) {
        return res.status(400).json({ msg: `Lo sentimos, el email ya se encuentra registrado` })
      }
    }

    Object.assign(superAdminBDD, datos)
    await superAdminBDD.save()

    res.status(200).json({ msg: "Datos actualizados correctamente" })
  } catch (error) {

  }
}

const actualizarAvatar = async (req, res) => {
  const id = req.user._id;

  const superAdminBDD = await SuperAdmin.findById(id);
  if (!superAdminBDD) {
    return res.status(404).json({ msg: 'Usuario no encontrado' });
  }

  try {
    const url = await profileService.handleProfileImage({ req, bodyField: 'avatar', filesField: 'imagen', folder: 'avatares', publicIdPrefix: id, required: true })
    superAdminBDD.avatar = url
    await superAdminBDD.save();
    res.status(200).json({ msg: 'Avatar actualizado correctamente', avatar: superAdminBDD.avatar })
  } catch (err) {
    if (err && err.type === 'VALIDATION') return res.status(400).json({ msg: err.message, code: err.code })
    if (err && err.type === 'UPLOAD_ERROR') return res.status(500).json({ msg: err.message, code: err.code })
    console.error(err)
    res.status(500).json({ msg: 'Error al subir imagen' })
  }
}

const actualizarPassword = async (req, res) => {
  // Request format validation moved to centralized validators (routes)

  try {
    const id = req.user._id
    const { passwordactual, passwordnuevo } = req.body

    if (!passwordactual || !passwordnuevo) return res.status(400).json({msg: "Completa los campos necesarios"})

    const superAdminBDD = await SuperAdmin.findById(id);
    if (!superAdminBDD) return res.status(404).json({ msg: "Lo sentimos, no existe el usuario" })

    const verificarPassword = await superAdminBDD.matchPassword(passwordactual);
    if (!verificarPassword) return res.status(400).json({ msg: "La contraseña actual no es la correcta" })

    superAdminBDD.password = await superAdminBDD.encrypPassword(passwordnuevo)
    await superAdminBDD.save();

    res.status(200).json({ msg: "Contraseña actualizada correctamente" })
  } catch (error) {
    console.log(error)
    res.status(500).json({ msg: "Error en el servidor" })
  }
}

const perfil = (req, res) => {
  delete req.user.token
  delete req.user.confirmEmail
  delete req.user.createdAt
  delete req.user.updatedAt
  delete req.user.__v
  res.status(200).json(req.user)
}

// Gestión estudiantes
// Gestión estudiantes: la creación de estudiantes por parte del SuperAdmin
// fue retirada por requerimiento. Las demás operaciones sobre estudiantes
// (listar, actualizar, eliminar, etc.) permanecen.

const obtenerEstudiantes = async (req, res) => {
  try {
    const estudiantes = await Estudiante.find()
      .populate('redComunitaria', 'nombre')

    res.json(estudiantes);
  } catch (error) {
    console.error('Error al obtener estudiantes:', error)
    res.status(500).json({ msg: 'Error al obtener estudiantes' })
  }
}

const obtenerEstudiantePorId = async (req, res) => {
  const id = req.params.id
  // ID validado por validators en rutas

  try {
    const estudiante = await Estudiante.findById(id)

    if (!estudiante) {
      return res.status(404).json({ msg: 'Estudiante no encontrado' })
    }

    res.json(estudiante)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

const actualizarEstudiante = async (req, res) => {
  const id = req.params.id;
  // ID validado por validators en rutas

  try {
    const estudiante = await Estudiante.findById(id);
    if (!estudiante) {
      return res.status(404).json({ msg: 'Estudiante no encontrado' });
    }

    const camposActualizados = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (value && value.toString().trim() !== '') {
        camposActualizados[key] = value;
      }
    }

    // Determinar si se solicita promover a Admin_Red
    const nuevoRolSolicitado = req.body.rol || (req.body.roles && (Array.isArray(req.body.roles) ? req.body.roles[0] : req.body.roles))
    const cambiandoARolAdmin = !estudiante.roles.includes('admin_red') && (nuevoRolSolicitado === 'Admin_Red' || (Array.isArray(req.body.roles) && req.body.roles.includes('admin_red')))

    // Solo si el estudiante sigue como Estudiante, puede actualizar redComunitaria
    if (req.body.redComunitaria && !cambiandoARolAdmin) {
      const nuevaRedId = req.body.redComunitaria;

      const redNueva = await RedComunitaria.findById(nuevaRedId);
      if (!redNueva) {
        return res.status(404).json({ msg: 'La nueva red comunitaria no existe' });
      }

      for (const redIdActual of estudiante.redComunitaria) {
        const redAnterior = await RedComunitaria.findById(redIdActual);
        if (redAnterior) {
          redAnterior.miembros = redAnterior.miembros.filter(id => !id.equals(estudiante._id));
          redAnterior.cantidadMiembros = redAnterior.miembros.length;
          await redAnterior.save();
        }
      }

      if (!redNueva.miembros.includes(estudiante._id)) {
        redNueva.miembros.push(estudiante._id);
        redNueva.cantidadMiembros = redNueva.miembros.length;
        await redNueva.save();
      }

      camposActualizados.redComunitaria = nuevaRedId;
    }

    if (Object.keys(camposActualizados).length === 0) {
      return res.status(400).json({ msg: 'Debes llenar al menos un campo a actualizar' });
    }

    // Determinar el rol objetivo: soporta legacy `rol` y nuevo `roles`
    let nuevoRol
    if (camposActualizados.rol) {
      nuevoRol = camposActualizados.rol
    } else if (Array.isArray(camposActualizados.roles)) {
      nuevoRol = camposActualizados.roles.includes('admin_red') ? 'Admin_Red' : 'Estudiante'
    } else {
      nuevoRol = estudiante.roles.includes('admin_red') ? 'Admin_Red' : 'Estudiante'
    }

    if (!['Estudiante', 'Admin_Red'].includes(nuevoRol)) {
      return res.status(400).json({ msg: 'Rol inválido. Solo se permite "Estudiante" o "Admin_Red"' });
    }

    // Convertir a Admin_Red
    if (!estudiante.roles.includes('admin_red') && (nuevoRol === 'Admin_Red' || (Array.isArray(req.body.roles) && req.body.roles.includes('admin_red')))) {
      const redComunitaria = req.body.redComunitaria;

      if (!redComunitaria) {
        return res.status(400).json({ msg: 'Debes especificar la red comunitaria para el nuevo Admin_Red' });
      }

      const red = await RedComunitaria.findById(redComunitaria);
      if (!red) {
        return res.status(404).json({ msg: 'La red comunitaria especificada no existe' });
      }

      if (!red.miembros.includes(estudiante._id)) {
        red.miembros.push(estudiante._id);
        red.cantidadMiembros = red.miembros.length;
        await red.save();
      }

      const nuevoEmail = estudiante.email;

      // Crear relación AdminRed (permiso sobre la red) y añadir rol al estudiante
      const existingRelation = await AdminRed.findOne({ usuarioId: estudiante._id, redId: redComunitaria })
      if (existingRelation) {
        return res.status(400).json({ msg: 'Ya existe una relación de admin para ese usuario y red' })
      }

      const rel = new AdminRed({ usuarioId: estudiante._id, redId: redComunitaria, estado: 'activo', fechaAprobacion: new Date() })
      await rel.save()

      // Añadir rol admin_red al estudiante
      await estudiante.addRole('admin_red')

      await enviarCorreoNuevoAdmin(estudiante.email, nuevoEmail);

      delete camposActualizados.redComunitaria;
    }

    // Convertir a Estudiante
    if (estudiante.roles.includes('admin_red') && (nuevoRol === 'Estudiante' || (Array.isArray(req.body.roles) && !req.body.roles.includes('admin_red')))) {
      // Revocar rol admin_red y eliminar relaciones activas
      await AdminRed.updateMany({ usuarioId: estudiante._id, estado: { $in: ['activo','pendiente'] } }, { $set: { estado: 'revocado' } })
      await estudiante.removeRole('admin_red')

      if (estudiante.redComunitaria) {
        // limpiar miembros de redes si corresponde
        for (const redId of estudiante.redComunitaria) {
          const red = await RedComunitaria.findById(redId)
          if (red && red.miembros.includes(estudiante._id)) {
            red.miembros = red.miembros.filter(idMiembro => !idMiembro.equals(estudiante._id))
            red.cantidadMiembros = red.miembros.length
            await red.save()
          }
        }

        if (!camposActualizados.redComunitaria) camposActualizados.redComunitaria = []
      }
    }

    // Encriptar nueva contraseña si se envía
    if (camposActualizados.password) {
      camposActualizados.password = await estudiante.encrypPassword(camposActualizados.password);
    }

    // Eliminar el campo rol legacy para evitar modificarlo directamente en Estudiante
    if (camposActualizados.rol) delete camposActualizados.rol;

    const estudianteActualizado = await Estudiante.findByIdAndUpdate(
      id,
      camposActualizados,
      { new: true }
    );

    res.json({ msg: 'Datos actualizados correctamente', estudiante: estudianteActualizado });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const eliminarEstudiante = async (req, res) => {
  const id = req.params.id
  // ID validado por validators en rutas

  try {
    // Verificar si el estudiante es admin de alguna red comunitaria
    const redComoCreador = await RedComunitaria.findOne({ creadaPor: id })
    const adminActivo = await AdminRed.findOne({ usuarioId: id, estado: 'activo' })

    if (redComoCreador || adminActivo) {
      return res.status(400).json({ msg: 'El estudiante es administrador de una red comunitaria. Debe revocarle el cargo de admin de red antes de eliminarlo.' })
    }

    const estudianteEliminado = await Estudiante.findByIdAndDelete(id)

    if (!estudianteEliminado) {
      return res.status(404).json({ msg: 'Estudiante no encontrado' })
    }

    res.json({ msg: 'Estudiante eliminado correctamente' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

const suspenderEstudiante = async (req, res) => {
  try {
    const { id } = req.params
    const estudiante = await Estudiante.findById(id)
    if (!estudiante) return res.status(404).json({ msg: 'Estudiante no encontrado' })

    estudiante.suspendido = true
    await estudiante.save()

    res.status(200).json({ msg: 'Estudiante suspendido correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: 'Error en el servidor' })
  }
}

const habilitarEstudiante = async (req, res) => {
  try {
    const { id } = req.params
    const estudiante = await Estudiante.findById(id)
    if (!estudiante) return res.status(404).json({ msg: 'Estudiante no encontrado' })

    estudiante.suspendido = false
    await estudiante.save()

    res.status(200).json({ msg: 'Estudiante habilitado correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: 'Error en el servidor' })
  }
}

//Controladores para la gestión de redes comunitarias
const obtenerRedes = async (req, res) => {
  const redes = await RedComunitaria.find().populate('miembros', 'nombre apellido email')
  res.json(redes);
}

const obtenerRedPorId = async (req, res) => {
  const id = req.params.id;
  // ID validado por validators en rutas

  try {
    const red = await RedComunitaria.findById(id).populate('miembros', 'nombre apellido email');

    if (!red) {
      return res.status(404).json({ msg: 'Red no encontrada' });
    }

    res.json(red);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

const actualizarRed = async (req, res) => {
  const id = req.params.id;
  // ID validado por validators en rutas

  try {
    const redExistente = await RedComunitaria.findById(id)
    if (!redExistente) {
      return res.status(404).json({ msg: "Red no encontrada" })
    }

    const { nombre, descripcion } = req.body

    if (!nombre && !descripcion && typeof req.body.deshabilitada === 'undefined') {
      return res.status(400).json({ msg: "Lo sentimos, debes llenar al menos un campo a actualizar" });
    }

    const camposActualizados = {};

    if (nombre) {

      const nombreExistente = await RedComunitaria.findOne({ nombre, _id: { $ne: id } })
      if (nombreExistente) {
        return res.status(400).json({ msg: "Ya existe una red con ese nombre" })
      }

      camposActualizados.nombre = nombre

    }

    if (descripcion) {
      camposActualizados.descripcion = descripcion
    }

    // Permitir a SuperAdmin deshabilitar o habilitar la red
    if (typeof req.body.deshabilitada !== 'undefined') {
      camposActualizados.deshabilitada = Boolean(req.body.deshabilitada)
    }

    const redActualizada = await RedComunitaria.findByIdAndUpdate(
      id,
      camposActualizados,
      { new: true }
    )

    res.json(redActualizada)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

const eliminarRed = async (req, res) => {
  const id = req.params.id
  // ID validado por validators en rutas

  try {
    const red = await RedComunitaria.findById(id)
    if (!red) return res.status(404).json({ msg: 'Red no encontrada' })

    // Verificar si existe un admin activo en adminRedes para esta red
    const adminActivo = await AdminRed.findOne({ redId: red._id, estado: 'activo' })
    if (adminActivo) {
      return res.status(400).json({ msg: 'La red tiene un administrador activo. Debe revocar el admin antes de eliminar la red.' })
    }

    await RedComunitaria.findByIdAndDelete(id)
    res.json({ mensaje: 'Red eliminada correctamente' })
  } catch (error) {
    res.status(500).json({ mensaje: error.message })
  }
}

const marcarRedVerificada = async (req, res) => {
  try {
    const id = req.params.id
    // ID validado por validators en rutas

    const { verificada = true } = req.body

    const red = await RedComunitaria.findById(id)
    if (!red) return res.status(404).json({ msg: 'Red no encontrada' })

    red.esVerificada = Boolean(verificada)
    await red.save()

    return res.status(200).json({ msg: 'Estado de verificación actualizado', red })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Error en el servidor' })
  }
}

export {
  login,
  recuperarPassword,
  comprobarTokenPassword,
  crearNuevoPassword,
  perfil,
  actualizarPerfil,
  actualizarAvatar,
  actualizarPassword,
  obtenerEstudiantes,
  obtenerEstudiantePorId,
  actualizarEstudiante,
  eliminarEstudiante,
  suspenderEstudiante,
  habilitarEstudiante,
  obtenerRedes,
  obtenerRedPorId,
  actualizarRed,
  eliminarRed,
  marcarRedVerificada
}
