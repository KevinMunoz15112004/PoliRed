import { Router } from 'express'
import passport from 'passport'
import jwt from 'jsonwebtoken'
import { signToken } from '../controllers/authController.js'
import { verificarEstadoLogin } from '../middlewares/verificarLogin.js'
import Estudiante from '../models/Estudiantes.js'
import RedComunitaria from '../models/RedComunitaria.js'

const loginRouter = Router()

loginRouter.get('/microsoft', verificarEstadoLogin, passport.authenticate('auth-microsoft', {
    prompt: "select_account",
    session: false,
}))

loginRouter.get('/microsoft/callback',
  passport.authenticate('auth-microsoft', { failureRedirect: "/auth/microsoft", session: false }),
  async (req, res) => {
    try {
      const user = req.user;

      let estudianteBDD = await Estudiante.findOne({ email: user.emails?.[0]?.value || user._json.mail });

      if (!estudianteBDD) {
        // generar usuario a partir del email si no existe
        let baseUsuario = (user.emails?.[0]?.value || user._json.mail || '').split('@')[0] || `ms${Date.now()}`
        let usuarioFinal = baseUsuario
        let sufijo = 0
        while (await Estudiante.findOne({ username: usuarioFinal })) {
          sufijo += 1
          usuarioFinal = `${baseUsuario}${sufijo}`
        }

        estudianteBDD = new Estudiante({
          nombre: user.name?.givenName || user._json.givenName,
          apellido: user.name?.familyName || user._json.surname,
          username: usuarioFinal,
          email: user.emails?.[0]?.value || user._json.mail,
          roles: ['estudiante'],
          authMicrosoft: true
        });
        // asignar redes globales automáticamente
        try {
          const redesGlobales = await RedComunitaria.find({ esGlobal: true }).select('_id')
          if (redesGlobales && redesGlobales.length > 0) {
            estudianteBDD.redComunitaria = redesGlobales.map(r => r._id)
          }
        } catch (err) {
          console.error('Error asignando redes globales a Microsoft user:', err)
        }

        await estudianteBDD.save();
      }

      const token = signToken(estudianteBDD, 'mobile')

      res.send(`<!DOCTYPE html>
        <html lang="en">
        <body></body>
        <script>
          window.opener.postMessage({
            token: "${token}",
            user: {
              id: "${estudianteBDD._id}",
              displayName: "${user.displayName}",
              email: "${estudianteBDD.email}",
              roles: ${JSON.stringify(estudianteBDD.roles || ['estudiante'])},
              name: {
                givenName: "${user.name?.givenName || user._json.givenName}",
                familyName: "${user.name?.familyName || user._json.surname}"
              }
            }
          }, "${process.env.FRONTEND_URL}");
          window.close();
        </script>
        </html>`);

    } catch (error) {
      console.error('Error en callback Microsoft:', error);
      res.status(500).send("Error interno en autenticación Microsoft");
    }
  }
);

export { loginRouter };
