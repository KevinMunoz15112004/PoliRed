import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs-extra'

const uploadFiles = async (files, folder, publicIdPrefix = '') => {
  if (!files) return []

  const normalizedFiles = Array.isArray(files) ? files : [files]

  const uploadOne = async (file, idx) => {
    try {
      const public_id = `${publicIdPrefix}_${Date.now()}_${idx}_${Math.random().toString(36).slice(2,8)}`
      const uploadFromStream = () => new Promise((resolve, reject) => {
        const callback = (error, result) => {
          console.log('Cloudinary upload callback for', public_id, 'error:', error, 'result:', result && result.secure_url)
          if (error) return reject(error)
          return resolve(result && result.secure_url)
        }

        console.log('Cloudinary: starting upload_stream for', public_id)
        const uploadStream = cloudinary.uploader.upload_stream({ folder, public_id, overwrite: true }, callback)

        if (file && file.data) {
          try {
            console.log('Cloudinary: sending buffer data for', public_id, 'size:', file.data && file.data.length)
            uploadStream.end(file.data)
          } catch (e) {
            return reject(e)
          }
        } else if (file && file.tempFilePath) {
          console.log('Cloudinary: piping temp file', file.tempFilePath, 'for', public_id)
          const readStream = fs.createReadStream(file.tempFilePath)
          readStream.on('error', reject)
          readStream.pipe(uploadStream)
        } else {
          // No data available to upload
          return reject(new Error('No file data or tempFilePath'))
        }
      })

      const secureUrl = await uploadFromStream()
      console.log('Cloudinary secure_url obtained for', public_id, secureUrl)
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
  const promises = normalizedFiles.map((f, i) => uploadOne(f, i))
  const results = await Promise.all(promises)
  return results.filter(Boolean)
}

export default { uploadFiles }
