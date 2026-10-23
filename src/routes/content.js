import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import { fileURLToPath } from 'url'
import { Faq } from '../models/Faq.js'
import { GalleryItem } from '../models/GalleryItem.js'
import { Review } from '../models/Review.js'
import { authorize, protect } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.join(__dirname, '../../uploads')
const admin = [protect, authorize('admin')]

function flag(value, fallback = true) {
  if (value === undefined || value === '') return fallback
  return value !== 'false' && value !== false
}

function imageFromRequest(req, current = '') {
  if (req.file) return `/uploads/${req.file.filename}`
  if (req.body.keepImage) return req.body.keepImage
  if (typeof req.body.image === 'string' && !req.body.image.startsWith('blob:')) return req.body.image
  return current
}

function removeUpload(image) {
  if (!image?.startsWith('/uploads/')) return
  fs.unlink(path.join(uploadDir, path.basename(image)), () => {})
}

function listHandler() {
  return (req, res, next) => {
    if (req.query.all !== '1') return next()
    protect(req, res, () => authorize('admin')(req, res, next))
  }
}

router.get('/gallery', listHandler(), async (req, res) => {
  const filter = req.query.all === '1' ? {} : { isActive: true }
  const items = await GalleryItem.find(filter).sort({ sortOrder: 1, createdAt: 1 })
  res.json({ items })
})

router.post('/gallery', ...admin, upload.single('image'), async (req, res) => {
  try {
    const { title, service, category, alt, span, sortOrder, isActive } = req.body
    if (!title?.trim()) return res.status(400).json({ message: 'Title is required' })
    if (!req.file) return res.status(400).json({ message: 'A photo is required' })
    const item = await GalleryItem.create({
      title: title.trim(),
      service: service || '',
      category: category?.trim() || 'Exterior',
      alt: alt?.trim() || title.trim(),
      span: ['wide', 'tall', 'feature'].includes(span) ? span : 'normal',
      image: imageFromRequest(req),
      sortOrder: Number(sortOrder) || 0,
      isActive: flag(isActive, true),
    })
    res.status(201).json({ item })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not add gallery photo' })
  }
})

router.put('/gallery/:id', ...admin, upload.single('image'), async (req, res) => {
  try {
    const item = await GalleryItem.findById(req.params.id)
    if (!item) return res.status(404).json({ message: 'Gallery photo not found' })
    const previous = item.image
    if (req.body.title?.trim()) item.title = req.body.title.trim()
    if (req.body.service !== undefined) item.service = req.body.service
    if (req.body.category?.trim()) item.category = req.body.category.trim()
    if (req.body.alt !== undefined) item.alt = req.body.alt || item.title
    if (['normal', 'wide', 'tall', 'feature'].includes(req.body.span)) item.span = req.body.span
    if (req.body.sortOrder !== undefined && req.body.sortOrder !== '') item.sortOrder = Number(req.body.sortOrder) || 0
    if (req.body.isActive !== undefined) item.isActive = flag(req.body.isActive, item.isActive)
    if (req.file || req.body.keepImage) item.image = imageFromRequest(req, item.image)
    await item.save()
    if (req.file && previous && previous !== item.image) removeUpload(previous)
    res.json({ item })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not update gallery photo' })
  }
})

router.delete('/gallery/:id', ...admin, async (req, res) => {
  const item = await GalleryItem.findByIdAndDelete(req.params.id)
  if (!item) return res.status(404).json({ message: 'Gallery photo not found' })
  removeUpload(item.image)
  res.json({ message: 'Gallery photo deleted' })
})

router.get('/faqs', listHandler(), async (req, res) => {
  const filter = req.query.all === '1' ? {} : { isActive: true }
  const faqs = await Faq.find(filter).sort({ sortOrder: 1, createdAt: 1 })
  res.json({ faqs })
})

router.post('/faqs', ...admin, async (req, res) => {
  try {
    const { question, answer, showOnHome, sortOrder, isActive } = req.body
    if (!question?.trim() || !answer?.trim()) {
      return res.status(400).json({ message: 'Question and answer are required' })
    }
    const faq = await Faq.create({
      question: question.trim(),
      answer: answer.trim(),
      showOnHome: flag(showOnHome, true),
      sortOrder: Number(sortOrder) || 0,
      isActive: flag(isActive, true),
    })
    res.status(201).json({ faq })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not add FAQ' })
  }
})

router.put('/faqs/:id', ...admin, async (req, res) => {
  try {
    const faq = await Faq.findById(req.params.id)
    if (!faq) return res.status(404).json({ message: 'FAQ not found' })
    if (req.body.question?.trim()) faq.question = req.body.question.trim()
    if (req.body.answer?.trim()) faq.answer = req.body.answer.trim()
    if (req.body.showOnHome !== undefined) faq.showOnHome = flag(req.body.showOnHome, faq.showOnHome)
    if (req.body.sortOrder !== undefined && req.body.sortOrder !== '') faq.sortOrder = Number(req.body.sortOrder) || 0
    if (req.body.isActive !== undefined) faq.isActive = flag(req.body.isActive, faq.isActive)
    await faq.save()
    res.json({ faq })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not update FAQ' })
  }
})

router.delete('/faqs/:id', ...admin, async (req, res) => {
  const faq = await Faq.findByIdAndDelete(req.params.id)
  if (!faq) return res.status(404).json({ message: 'FAQ not found' })
  res.json({ message: 'FAQ deleted' })
})

router.get('/reviews', listHandler(), async (req, res) => {
  const filter = req.query.all === '1' ? {} : { isActive: true }
  const reviews = await Review.find(filter).sort({ sortOrder: 1, createdAt: 1 })
  res.json({ reviews })
})

router.post('/reviews', ...admin, async (req, res) => {
  try {
    const { quote, name, car, service, rating, featured, sortOrder, isActive } = req.body
    if (!quote?.trim() || !name?.trim()) {
      return res.status(400).json({ message: 'Name and review text are required' })
    }
    const stars = Math.min(5, Math.max(1, Number(rating) || 5))
    const review = await Review.create({
      quote: quote.trim(),
      name: name.trim(),
      car: car || '',
      service: service || '',
      rating: stars,
      featured: flag(featured, false),
      sortOrder: Number(sortOrder) || 0,
      isActive: flag(isActive, true),
    })
    res.status(201).json({ review })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not add review' })
  }
})

router.put('/reviews/:id', ...admin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
    if (!review) return res.status(404).json({ message: 'Review not found' })
    if (req.body.quote?.trim()) review.quote = req.body.quote.trim()
    if (req.body.name?.trim()) review.name = req.body.name.trim()
    if (req.body.car !== undefined) review.car = req.body.car
    if (req.body.service !== undefined) review.service = req.body.service
    if (req.body.rating !== undefined && req.body.rating !== '') {
      review.rating = Math.min(5, Math.max(1, Number(req.body.rating) || 5))
    }
    if (req.body.featured !== undefined) review.featured = flag(req.body.featured, review.featured)
    if (req.body.sortOrder !== undefined && req.body.sortOrder !== '') review.sortOrder = Number(req.body.sortOrder) || 0
    if (req.body.isActive !== undefined) review.isActive = flag(req.body.isActive, review.isActive)
    await review.save()
    res.json({ review })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not update review' })
  }
})

router.delete('/reviews/:id', ...admin, async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id)
  if (!review) return res.status(404).json({ message: 'Review not found' })
  res.json({ message: 'Review deleted' })
})

export default router
