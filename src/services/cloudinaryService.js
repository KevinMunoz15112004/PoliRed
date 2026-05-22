import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs-extra'
import { PassThrough } from 'stream'

const uploadFiles = async (files, folder, publicIdPrefix = '') => {
  if (!files || files.length === 0) return []

  const uploadOne = async (file, idx) => {
    try {
      const public_id = `${publicIdPrefix}_${Date.now()}_${idx}_${Math.random().toString(36).slice(2,8)}`

      const secureUrl = await new Promise((resolve, reject) => {
        let settled = false
        let timeoutId

        const safeResolve = (value) => {
          if (settled) return
          settled = true
          clearTimeout(timeoutId)
          resolve(value)
        }

        const safeReject = (error) => {
          if (settled) return
          settled = true
          clearTimeout(timeoutId)
          reject(error)
        }

        timeoutId = setTimeout(() => {
          console.error(`[Cloudinary] Timeout activado para index ${idx} tras 25 segundos`)
          safeReject(new Error('TIMEOUT_CLOUDINARY'))
        }, 25000)

        const callback = (error, result) => {
          if (error) {
            console.error(`[Cloudinary] Callback error para index ${idx}:`, error)
            return safeReject(error)
          }
          return safeResolve(result && result.secure_url)
        }

        const uploadStream = cloudinary.uploader.upload_stream({ folder, public_id, overwrite: true }, callback)

        uploadStream.on('error', (err) => {
          console.error(`[Cloudinary] Stream emit error index ${idx}:`, err)
          safeReject(err)
        })

        if (file && file.data) {
          const bufferStream = new PassThrough()
          bufferStream.end(file.data)
          bufferStream.pipe(uploadStream)
        } else if (file && file.tempFilePath) {
          const readStream = fs.createReadStream(file.tempFilePath)
          readStream.on('error', (err) => {
            console.error(`[Cloudinary] ReadStream error index ${idx}:`, err)
            safeReject(err)
          })
          readStream.pipe(uploadStream)
        } else {
          console.error(`[Cloudinary] Sin datos para index ${idx}`)
          return safeReject(new Error('No file data or tempFilePath'))
        }
      })

      return secureUrl
    } catch (err) {
      console.error(`[Cloudinary] Upload fallido para index ${idx}:`, err)
      throw {
        type: 'UPLOAD_ERROR',
        code: 'CLOUDINARY_FAIL',
        message: err.message === 'TIMEOUT_CLOUDINARY' ? 'Tiempo de espera agotado al subir imagen' : 'Error subiendo imagen a Cloudinary'
      }
    } finally {
      try {
        if (file && file.tempFilePath) await fs.unlink(file.tempFilePath)
      } catch (e) {
        // swallow cleanup errors
      }
    }
  }

  const results = []
  for (let i = 0; i < files.length; i++) {
    try {
      const url = await uploadOne(files[i], i)
      if (url) results.push(url)
    } catch (error) {
      console.error(`[Cloudinary] Abortando subidas restantes por fallo en archivo index ${i}`)
      throw error // Lanza el error al mediaService
    }
  }
  
  return results.filter(Boolean)
}

export default { uploadFiles }
