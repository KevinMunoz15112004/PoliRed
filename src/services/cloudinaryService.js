import cloudinary from 'cloudinary'
import fs from 'fs-extra'

const uploadFiles = async (files, folder, publicIdPrefix = '') => {
  if (!files || files.length === 0) return []

  const uploadOne = async (file, idx) => {
    try {
      const public_id = `${publicIdPrefix}_${Date.now()}_${idx}_${Math.random().toString(36).slice(2,8)}`
      const res = await cloudinary.uploader.upload(file.tempFilePath, {
        folder,
        public_id,
        overwrite: true
      })
      return res.secure_url
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
