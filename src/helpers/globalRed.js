import RedComunitaria from '../models/RedComunitaria.js'

// Simple in-memory cache for global red ids/docs
const CACHE_TTL = 30 * 1000 // 30 seconds
const cache = {
  ids: null, // array of string ids
  id: null, // single string id (first)
  last: 0
}

async function refreshCache() {
  try {
    const reds = await RedComunitaria.find({ esGlobal: true }).select('_id').lean()
    cache.ids = reds.map(r => String(r._id))
    cache.id = cache.ids.length ? cache.ids[0] : null
    cache.last = Date.now()
  } catch (e) {
    console.error('globalRed.refreshCache error:', e)
    cache.ids = cache.ids || []
    cache.id = cache.id || null
    cache.last = Date.now()
  }
}

async function ensureCache() {
  if (!cache.ids || (Date.now() - cache.last) > CACHE_TTL) {
    await refreshCache()
  }
}

async function getGlobalIds() {
  await ensureCache()
  return cache.ids || []
}

async function getGlobalId() {
  await ensureCache()
  return cache.id
}

// Returns the global RedComunitaria doc (fresh read from DB)
async function getGlobalRedDoc() {
  const id = await getGlobalId()
  if (!id) return null
  return RedComunitaria.findById(id)
}

async function isGlobalRed(id) {
  if (!id) return false
  const ids = await getGlobalIds()
  return ids.includes(String(id))
}

// Filter array of ids (ObjectId or strings) to remove global ids
async function filterOutGlobalIds(arr) {
  if (!Array.isArray(arr)) return arr
  const ids = await getGlobalIds()
  const set = new Set(ids)
  return arr.filter(v => !set.has(String(v)))
}

// Helper to use in mongoose populate to exclude global red
function populateExcludeGlobalMatch() {
  return { match: { esGlobal: { $ne: true } } }
}

export { getGlobalIds, getGlobalId, getGlobalRedDoc, isGlobalRed, filterOutGlobalIds, populateExcludeGlobalMatch, refreshCache }
