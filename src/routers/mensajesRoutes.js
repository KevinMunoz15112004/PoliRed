import express from 'express';
import Mensaje from '../models/Mensajes.js';
import { verifyToken } from '../middlewares/auth.js';
import mongoose from 'mongoose';
import Estudiantes from '../models/Estudiantes.js';

const router = express.Router();

router.get('/mensajes/historial/:estudianteA/:estudianteB', verifyToken, async (req, res) => {
  const { estudianteA, estudianteB } = req.params;

  if (!mongoose.Types.ObjectId.isValid(estudianteA) || !mongoose.Types.ObjectId.isValid(estudianteB)) {
    return res.status(400).json({ msg: 'Uno o ambos IDs no son válidos' })
  }

  if (!estudianteA || !estudianteB) {
    return res.status(400).json({ msg: 'Faltan parámetros requeridos en la URL' })
  }

  try {

     const [existeA, existeB] = await Promise.all([
      Estudiantes.exists({ _id: estudianteA }),
      Estudiantes.exists({ _id: estudianteB })
    ])

    if (!existeA || !existeB) {
      return res.status(404).json({ msg: 'Uno o ambos estudiantes no existen' })
    }

    const mensajes = await Mensaje.find({
      $or: [
        { autor: estudianteA, destinatario: estudianteB },
        { autor: estudianteB, destinatario: estudianteA }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('autor', 'nombre apellido');

    res.json(mensajes);
  } catch (error) {
    res.status(500).json({ msg: 'Error al obtener mensajes' });
  }
});

export default router;
