import { Router } from 'express'
import { Service } from '../models/Service.js'
import { authorize, protect } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'

const router = Router()

function parseSteps(raw) {
  let steps = raw
  if (typeof steps === 'string') {
    try {
      steps = JSON.parse(steps)
    } catch {
      steps = []
    }
  }
  if (!Array.isArray(steps)) return []
  return steps
    .filter((step) => step && String(step.title || '').trim())
    .map((step, index) => ({
      title: String(step.title).trim(),
      description: step.description || '',
      order: step.order ?? index,
    }))
}

function imageFromRequest(req, current = '') {
  if (req.file) return `/uploads/${req.filename || req.file.filename}`
  if (req.body.keepImage) return req.body.keepImage
  if (typeof req.body.image === 'string' && !req.body.image.startsWith('blob:')) return req.body.image
  return current
}

router.get('/', async (req, res) => {
  const filter = req.query.all === '1' ? {} : { isActive: true }
  const services = await Service.find(filter).sort({ sortOrder: 1, createdAt: -1 })
  res.json({ services })
})

router.get('/:id', async (req, res) => {
  const service = await Service.findById(req.params.id)
  if (!service) return res.status(404).json({ message: 'Service not found' })
  res.json({ service })
})

router.post('/', protect, authorize('admin'), upload.single('image'), async (req, res) => {
  try {
    const { title, description, price, durationMinutes, steps, sortOrder, isActive, category, slug } = req.body
    if (!title || price === undefined || price === '') {
      return res.status(400).json({ message: 'Title and price are required' })
    }

    const service = await Service.create({
      title,
      description: description || '',
      price: Number(price),
      durationMinutes: Number(durationMinutes) || 60,
      image: imageFromRequest(req),
      steps: parseSteps(steps),
      sortOrder: Number(sortOrder) || 0,
      category: category === 'package' ? 'package' : 'service',
      slug: slug || undefined,
      isActive: isActive !== 'false' && isActive !== false,
    })

    res.status(201).json({ service })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not create service' })
  }
})

router.put('/:id', protect, authorize('admin'), upload.single('image'), async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
    if (!service) return res.status(404).json({ message: 'Service not found' })

    const fields = ['title', 'description', 'sortOrder', 'slug']
    for (const key of fields) {
      if (req.body[key] !== undefined && req.body[key] !== '') service[key] = req.body[key]
    }
    if (req.body.price !== undefined && req.body.price !== '') service.price = Number(req.body.price)
    if (req.body.durationMinutes !== undefined && req.body.durationMinutes !== '') {
      service.durationMinutes = Number(req.body.durationMinutes)
    }
    if (req.body.category === 'package' || req.body.category === 'service') service.category = req.body.category
    if (req.body.isActive !== undefined) service.isActive = req.body.isActive !== 'false' && req.body.isActive !== false
    if (req.file || req.body.keepImage || typeof req.body.image === 'string') {
      service.image = imageFromRequest(req, service.image)
    }
    if (req.body.steps !== undefined) service.steps = parseSteps(req.body.steps)

    await service.save()
    res.json({ service })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not update service' })
  }
})

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  const service = await Service.findByIdAndDelete(req.params.id)
  if (!service) return res.status(404).json({ message: 'Service not found' })
  res.json({ message: 'Service deleted' })
})

export default router
