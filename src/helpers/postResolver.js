import Publicacion from '../models/Publicaciones.js'
import { Articulo } from '../models/Articulos.js'

export const _resolvePostDoc = async (id) => {
  let doc = await Publicacion.findById(id)
  if (doc) return { doc, autorId: doc.autorId, comunidadId: doc.comunidadId, isArticulo: false }
  doc = await Articulo.findById(id)
  if (doc) return { doc, autorId: doc.autorId, comunidadId: doc.redComunitaria, isArticulo: true }
  return null
}
