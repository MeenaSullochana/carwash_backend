import { Accessory } from '../models/Accessory.js'
import { Service } from '../models/Service.js'
import { carAccessoryCatalog, serviceCatalog } from '../data/catalog.js'

export async function ensureCatalog() {
  for (const item of serviceCatalog) {
    let doc = await Service.findOne({ slug: item.slug })
    if (!doc) {
      doc = await Service.findOne({ title: item.title })
    }
    if (!doc) {
      await Service.create({ ...item, isActive: true })
      continue
    }
    if (!doc.slug) doc.slug = item.slug
    if (!doc.category) doc.category = item.category
    if (!doc.steps?.length && item.steps.length) doc.steps = item.steps
    if (!doc.image && item.image) doc.image = item.image
    await doc.save()
  }

  for (const item of carAccessoryCatalog) {
    const exists = await Accessory.findOne({ name: item.name })
    if (!exists) {
      await Accessory.create({ ...item, description: 'Item that may already be in the customer car', isActive: true })
    }
  }
}
