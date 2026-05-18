import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import cloudinary from 'cloudinary'
import fileUpload from "express-fileupload"

import superAdminRoutes from './routers/superAdminRoutes.js'
import estudiantesRoutes from './routers/estudiantesRoutes.js'
import authRoutes from './routers/authRoutes.js'
import adminRedes from './routers/adminRedRoutes.js'
import socialRoutes from './routers/socialRoutes.js'

dotenv.config()

const app = express()

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

app.use(fileUpload({
    useTempFiles: false
}))

app.set('port', process.env.PORT || 3000)

app.use(cors())
app.use(express.json())

// rutas
app.use('/api', superAdminRoutes)
app.use('/api', authRoutes)
app.use('/api', adminRedes)
app.use('/api', estudiantesRoutes)
app.use('/api', socialRoutes)

app.get('/', (req, res) => {
    res.send("✅ Server On Vercel")
})

app.use((req, res) => {
    res.status(404).json({ error: "Ruta no encontrada" })
})

export default app