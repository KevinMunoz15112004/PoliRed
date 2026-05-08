import request from 'supertest'
import { app } from '../server.js'

describe('Pruebas de rutas de estudiantes', () => {

  it('POST /api/registro-estudiantes - debería registrar un estudiante (falla por datos faltantes)', async () => {
    const res = await request(app).post('/api/registro-estudiantes').send({})
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/login-estudiante - debería fallar con credenciales vacías', async () => {
    const res = await request(app).post('/api/login-estudiante').send({})
    expect(res.statusCode).toBe(400) 
  })

  it('GET /api/publicaciones/listar - sin token debe devolver 403 o 401', async () => {
    const res = await request(app).get('/api/publicaciones/listar')
    expect([401, 403]).toContain(res.statusCode)
  })

  it('GET /api/redes/listar - sin token debe devolver 401 o 403', async () => {
    const res = await request(app).get('/api/redes/listar')
    expect([401, 403]).toContain(res.statusCode)
  })

  it('GET /api/no-existe - debe devolver 404', async () => {
    const res = await request(app).get('/api/no-existe')
    expect(res.statusCode).toBe(404)
  })
})
