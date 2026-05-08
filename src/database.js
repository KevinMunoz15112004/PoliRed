import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

mongoose.set('strictQuery', true)

const connection = async()=>{
    try {
        const {connection} = await mongoose.connect(process.env.MONGODB_URI_LOCAL)
        console.log(`Database is connected on ${connection.host} - ${connection.port}`)
        // Asegurar que exista una red global (esGlobal: true)
        try {
            const { default: RedComunitaria } = await import('./models/RedComunitaria.js')
            const existente = await RedComunitaria.findOne({ esGlobal: true })
            if (!existente) {
                const redGlobal = new RedComunitaria({
                    nombre: 'Red Global',
                    descripcion: 'Red global pública de la plataforma',
                    miembros: [],
                    cantidadMiembros: 0,
                    esGlobal: true,
                    estadoAprobacion: 'aprobada'
                })
                await redGlobal.save()
                console.log('Red global creada automáticamente')
            }
        } catch (err) {
            console.error('No se pudo asegurar red global:', err)
        }
    } catch (error) {
        console.log(error);
    }
}

export default connection