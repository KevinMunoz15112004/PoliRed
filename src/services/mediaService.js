import cloudinaryService from './cloudinaryService.js'

const MAX_IMAGES = 3

const normalizeUrls = (input) => {
  if (!input) return []
  if (Array.isArray(input)) return input.map(String).map(s => s.trim()).filter(Boolean)
  if (typeof input === 'string') {
    const str = input.trim()
    // try JSON parse
    try {
      const parsed = JSON.parse(str)
      if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim()).filter(Boolean)
    } catch (e) {
      // not JSON
    }
    // comma separated
    return str.split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

const getFilesFromReq = (req, field = 'imagen') => {
  if (!req || !req.files) return []
  const f = req.files[field]
  if (!f) return []
  return Array.isArray(f) ? f : [f]
}

const validateMax = (count) => {
  return count <= MAX_IMAGES
}

const handleMedia = async ({ req, bodyField = 'mediaUrls', filesField = 'imagen', folder = 'uploads', publicIdPrefix = '' }) => {
  // Normalize urls from body
  const bodyVal = req.body ? req.body[bodyField] : null
  const urls = normalizeUrls(bodyVal)

  // Extract files
  const files = getFilesFromReq(req, filesField)

  if ((urls.length + files.length) === 0) {
    throw {
      type: 'VALIDATION',
      code: 'MISSING_IMAGES',
      message: 'Debes enviar mediaUrls o subir al menos una imagen'
    }
  }

  if (!validateMax(urls.length + files.length)) {
    throw {
      type: 'VALIDATION',
      code: 'MAX_IMAGES_EXCEEDED',
      message: `Solo puedes subir hasta ${MAX_IMAGES} imágenes`
    }
  }

  let uploaded = []
  if (files.length > 0) {
    // Upload in parallel via cloudinaryService
    try {
      uploaded = await cloudinaryService.uploadFiles(files, folder, publicIdPrefix)
    } catch (err) {
      // if cloudinaryService already throws structured error, rethrow
      if (err && err.type) throw err
      throw {
        type: 'UPLOAD_ERROR',
        code: 'CLOUDINARY_FAIL',
        message: 'Error subiendo imagen a Cloudinary'
      }
    }
  }

  const combined = [...urls, ...uploaded].slice(0, MAX_IMAGES)
  return combined
}

export default {
  normalizeUrls,
  getFilesFromReq,
  validateMax,
  handleMedia,
  MAX_IMAGES
}
