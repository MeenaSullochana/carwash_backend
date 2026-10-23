import { faqSeed, gallerySeed, reviewSeed } from '../data/siteContent.js'
import { Faq } from '../models/Faq.js'
import { GalleryItem } from '../models/GalleryItem.js'
import { Review } from '../models/Review.js'

async function insertMissing(Model, items) {
  for (const item of items) {
    const exists = await Model.findOne({ key: item.key })
    if (!exists) await Model.create({ ...item, isActive: true })
  }
}

export async function ensureContent() {
  await insertMissing(GalleryItem, gallerySeed)
  await insertMissing(Faq, faqSeed)
  await insertMissing(Review, reviewSeed)
}
