import cloudinaryService from './cloudinaryService.js'

const normalizeSingleUrl = (input) => {
  if (!input) return null
  if (Array.isArray(input)) return String(input[0]).trim() || null
  if (typeof input === 'string') {
    const s = input.trim()
    try {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) return String(parsed[0]).trim() || null
    } catch (e) {
      // not JSON
    }
    if (s.includes(',')) return s.split(',').map(x => x.trim()).filter(Boolean)[0] || null
    return s || null
  }
  return null
}

const handleProfileImage = async ({ req, bodyField = 'fotoPerfil', filesField = 'imagen', folder = 'avatars', publicIdPrefix = '', required = false }) => {
  // Prefer uploaded file
  const files = req && req.files && req.files[filesField] ? (Array.isArray(req.files[filesField]) ? req.files[filesField] : [req.files[filesField]]) : []
  if (files.length > 1) {
    throw { type: 'VALIDATION', code: 'SINGLE_IMAGE_ONLY', message: 'Solo se permite una imagen para el perfil' }
  }

  if (files.length === 1) {
    try {
      const urls = await cloudinaryService.uploadFiles(files, folder, publicIdPrefix)
      return urls[0] || null
    } catch (err) {
      if (err && err.type) throw err
      throw { type: 'UPLOAD_ERROR', code: 'CLOUDINARY_FAIL', message: 'Error subiendo imagen a Cloudinary' }
    }
  }

  // No uploaded files, check body field
  const bodyVal = req && req.body ? req.body[bodyField] : null
  const url = normalizeSingleUrl(bodyVal)
  if (!url && required) {
    throw { type: 'VALIDATION', code: 'MISSING_IMAGE', message: 'Debes enviar una imagen para el perfil' }
  }
  return url
}

export default { handleProfileImage }
