import cloudinary from 'cloudinary'
import fs from 'fs-extra'
import { PassThrough } from 'stream'

const uploadFiles = async (files, folder, publicIdPrefix = '') => {
  if (!files || files.length === 0) return []

  const uploadOne = async (file, idx) => {
    try {
      const public_id = `${publicIdPrefix}_${Date.now()}_${idx}_${Math.random().toString(36).slice(2,8)}`
      const uploadFromStream = () => new Promise((resolve, reject) => {
        const callback = (error, result) => {
          if (error) return reject(error)
          return resolve(result && result.secure_url)
        }

        const uploadStream = cloudinary.uploader.upload_stream({ folder, public_id, overwrite: true }, callback)

        if (file && file.data) {
          const bufferStream = new PassThrough()
          bufferStream.end(file.data)
          bufferStream.pipe(uploadStream)
        } else if (file && file.tempFilePath) {
          const readStream = fs.createReadStream(file.tempFilePath)
          readStream.on('error', reject)
          readStream.pipe(uploadStream)
        } else {
          // No data available to upload
          return reject(new Error('No file data or tempFilePath'))
        }
      })

      const secureUrl = await uploadFromStream()
      return secureUrl
    } catch (err) {
      console.error('Cloudinary upload error:', err)
      throw {
        type: 'UPLOAD_ERROR',
        code: 'CLOUDINARY_FAIL',
        message: 'Error subiendo imagen a Cloudinary'
      }
    } finally {
      try {
        if (file && file.tempFilePath) await fs.unlink(file.tempFilePath)
      } catch (e) {
        // swallow cleanup errors
      }
    }
  }

  // Upload in parallel
  const promises = files.map((f, i) => uploadOne(f, i))
  const results = await Promise.all(promises)
  return results.filter(Boolean)
}

export default { uploadFiles }
