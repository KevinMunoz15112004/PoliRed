import app from './server.js'
import connection from './database.js'

let isConnected = false

export default async function handler(req, res) {

    if (!isConnected) {
        await connection()
        isConnected = true
    }

    return app(req, res)
}