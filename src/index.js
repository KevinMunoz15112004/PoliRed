import dns from 'dns'
dns.setDefaultResultOrder('ipv4first')

import { app, server } from './server.js'
import connection from './database.js'

connection()

server.listen(app.get('port'),()=>{
    console.log(`Server ok on PORT ${app.get('port')}`);
})