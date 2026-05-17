import nodemailer from "nodemailer"
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../../.env') })

let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.USER_MAILTRAP,
        pass: process.env.PASS_MAILTRAP
    },
    tls: {
        rejectUnauthorized: false
    }
});

// --- PLANTILLA BASE HTML ---
// Usamos el azul extraído de tu logo para mantener la coherencia visual.
const generarPlantillaHTML = (titulo, contenido) => `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        .header { background-color: #003fa3; padding: 30px; text-align: center; }
        .header img { width: 100px; height: auto; }
        .content { padding: 40px 30px; color: #333333; line-height: 1.6; text-align: center; }
        .content h1 { color: #003fa3; font-size: 24px; margin-top: 0; margin-bottom: 20px; }
        .button { background-color: #003fa3; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 20px 0; letter-spacing: 0.5px; }
        .content p { font-size: 16px; margin: 10px 0; color: #555555; }
        .footer { background-color: #f9fbfb; padding: 20px; text-align: center; font-size: 13px; color: #888888; border-top: 1px solid #eeeeee; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <!-- IMPORTANTE: Reemplaza esta URL con la ruta pública donde alojes tu logo -->
            <img src="${process.env.LOGO_URL || 'https://tu-dominio.com/assets/logo-polired.png'}" alt="Logo PoliRed">
        </div>
        <div class="content">
            <h1>${titulo}</h1>
            ${contenido}
        </div>
        <div class="footer">
            El equipo de PoliRed te da la bienvenida.<br>
            &copy; ${new Date().getFullYear()} PoliRed. Todos los derechos reservados.
        </div>
    </div>
</body>
</html>
`;

// --- FUNCIONES DE ENVÍO ---

const sendMailToRecoveryPasswordE = async (userMail, token) => {
    try {
        let info = await transporter.sendMail({
            from: '"PoliRed" <polired@policonecta.com>',
            to: userMail,
            subject: "Restablece tu contraseña - PoliRed",
            html: generarPlantillaHTML(
                "Recuperación de Contraseña",
                `<p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
                 <a href="${process.env.FRONTEND_URL}/recuperarpassword-e/${token}" class="button">Restablecer Contraseña</a>
                 <p style="font-size: 14px;">Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>`
            )
        });
        console.log("Mensaje de recuperación (E) enviado satisfactoriamente: ", info.messageId);
    } catch (error) {
        console.error("Error al enviar correo de recuperación (E):", error);
    }
}

const sendMailToRecoveryPassword = async (userMail, token) => {
    try {
        let info = await transporter.sendMail({
            from: '"PoliRed" <polired@policonecta.com>',
            to: userMail,
            subject: "Restablece tu contraseña - PoliRed",
            html: generarPlantillaHTML(
                "Recuperación de Contraseña",
                `<p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
                 <a href="${process.env.FRONTEND_URL}/recuperarpassword/${token}" class="button">Restablecer Contraseña</a>
                 <p style="font-size: 14px;">Si no solicitaste este cambio, por favor ignora este mensaje.</p>`
            )
        });
        console.log("Mensaje de recuperación enviado satisfactoriamente: ", info.messageId);
    } catch (error) {
        console.error("Error al enviar correo de recuperación:", error);
    }
}

const sendMailToRegister = async (userMail, token) => {
    try {
        let info = await transporter.sendMail({
            from: '"PoliRed" <polired@policonecta.com>',
            to: userMail,
            subject: "Confirma tu cuenta en PoliRed",
            html: generarPlantillaHTML(
                "¡Bienvenido a PoliRed!",
                `<p>Estamos felices de tenerte con nosotros. Para comenzar, solo necesitas confirmar tu dirección de correo electrónico.</p>
                 <a href="${process.env.FRONTEND_URL}/confirmar-cuenta/${token}" class="button">Confirmar mi cuenta</a>`
            )
        });
        console.log("Mensaje de registro enviado satisfactoriamente:", info.messageId);
    } catch (error) {
        console.error("Error al enviar correo de registro:", error);
    }
}

const enviarCorreoNuevoAdmin = async (correoOriginal, nuevoCorreo) => {
    try {
        let info = await transporter.sendMail({
            from: '"PoliRed" <polired@policonecta.com>',
            to: correoOriginal,
            subject: "Has sido promovido a Admin_Red - PoliRed",
            html: generarPlantillaHTML(
                "Actualización de Rol",
                `<p>Hola, tu rol ha sido actualizado a <strong>Admin_Red</strong> en la plataforma PoliRed.</p>
                 <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: left;">
                    <p style="margin: 0;"><strong>Nuevo correo de acceso:</strong> ${nuevoCorreo}</p>
                 </div>
                 <p>Mantendrás la misma contraseña de tu cuenta de estudiante para el entorno administrativo.</p>`
            )
        });
        console.log(`Correo de nuevo admin enviado a ${correoOriginal}:`, info.messageId);
    } catch (error) {
        console.error("Error al enviar correo de nuevo admin:", error);
    }
}

export {
    sendMailToRecoveryPassword,
    sendMailToRecoveryPasswordE,
    sendMailToRegister,
    enviarCorreoNuevoAdmin
}

const sendMailRedAprobada = async (userMail, redName) => {
    try {
        let info = await transporter.sendMail({
            from: '"PoliRed" <polired@policonecta.com>',
            to: userMail,
            subject: `Tu red "${redName}" ha sido aprobada - PoliRed`,
            html: generarPlantillaHTML(
                'Solicitud de red aprobada',
                `<p>¡Felicidades! Tu solicitud para crear la red <strong>${redName}</strong> ha sido aprobada por el equipo de PoliRed.</p>
                 <p>La red ya está disponible en la plataforma.</p>`
            )
        });
        console.log(`Correo de red aprobada enviado a ${userMail}:`, info.messageId);
    } catch (error) {
        console.error('Error al enviar correo de red aprobada:', error);
    }
}

const sendMailRedRechazada = async (userMail, redName) => {
    try {
        let info = await transporter.sendMail({
            from: '"PoliRed" <polired@policonecta.com>',
            to: userMail,
            subject: `Tu red "${redName}" fue rechazada - PoliRed`,
            html: generarPlantillaHTML(
                'Solicitud de red rechazada',
                `<p>Lamentamos informarte que tu solicitud para crear la red <strong>${redName}</strong> ha sido rechazada.</p>
                 <p>Si crees que se trata de un error, por favor contacta con el soporte.</p>`
            )
        });
        console.log(`Correo de red rechazada enviado a ${userMail}:`, info.messageId);
    } catch (error) {
        console.error('Error al enviar correo de red rechazada:', error);
    }
}

export { sendMailRedAprobada, sendMailRedRechazada }