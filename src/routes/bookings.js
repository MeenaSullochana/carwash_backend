import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Router } from 'express'
import { Booking } from '../models/Booking.js'
import { Service } from '../models/Service.js'
import { Accessory } from '../models/Accessory.js'
import { User } from '../models/User.js'
import { authorize, protect } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'

const router = Router()

const STAFF_ROLES = ['admin', 'supervisor', 'staff', 'washer']
const FLOOR_ROLES = ['admin', 'supervisor', 'staff', 'washer']

function isStaff(user) {
  return STAFF_ROLES.includes(user.role)
}

function pushStatus(booking, status, userId, note = '') {
  booking.status = status
  booking.statusHistory.push({ status, by: userId, note, at: new Date() })
}

function checklistFromService(service) {
  const steps = [...(service.steps || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
  if (!steps.length) {
    return [
      {
        title: service.title,
        description: service.description || 'Complete this service',
        done: false,
      },
    ]
  }
  return steps.map((step) => ({
    stepId: step._id,
    title: step.title,
    description: step.description || '',
    done: false,
  }))
}

function populateBooking(query) {
  return query
    .populate('client', 'name email phone')
    .populate('service', 'title price description steps category')
    .populate('assignedStaff', 'name email phone role')
    .populate('workItems.doneBy', 'name role')
    .populate('intake.savedBy', 'name role')
    .populate('submission.submittedBy', 'name role')
    .populate('submission.workers', 'name role')
    .populate('invoice.generatedBy', 'name role')
    .populate('completedBy', 'name role')
}

async function loadBooking(id) {
  return populateBooking(Booking.findById(id))
}

function canView(booking, user) {
  if (user.role === 'client') {
    const clientId = booking.client?._id || booking.client
    return String(clientId) === String(user._id)
  }
  return isStaff(user)
}

function locked(booking) {
  return ['submitted', 'billed', 'completed', 'cancelled'].includes(booking.status)
}

const uploadDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads')
const MAX_JOB_IMAGES = 24

function closedJob(booking) {
  return ['completed', 'cancelled'].includes(booking.status)
}

function rememberStaff(booking, userId) {
  if (!booking.assignedStaff.some((id) => String(id) === String(userId))) {
    booking.assignedStaff.push(userId)
  }
}

function addJobImages(booking, field, files) {
  const paths = (files || []).map((file) => `/uploads/${file.filename}`)
  if (!paths.length) return 'Choose at least one image'
  const next = [...(booking[field] || []), ...paths]
  if (next.length > MAX_JOB_IMAGES) return `You can keep up to ${MAX_JOB_IMAGES} photos`
  booking[field] = next
  return ''
}

function removeJobImage(booking, field, image) {
  const current = booking[field] || []
  if (!image || !current.includes(image)) return false
  booking[field] = current.filter((item) => item !== image)
  const stillUsed = [...(booking.beforeImages || []), ...(booking.afterImages || [])].includes(image)
  const filename = path.basename(image)
  if (!stillUsed && image.startsWith('/uploads/') && filename && filename !== '.' && filename !== '..') {
    fs.rmSync(path.join(uploadDir, filename), { force: true })
  }
  return true
}

router.use(protect)

router.get('/', async (req, res) => {
  try {
    const filter = {}
    const { status, scope } = req.query

    if (req.user.role === 'client') {
      filter.client = req.user._id
    } else if (scope === 'mine') {
      filter.$or = [
        { assignedStaff: req.user._id },
        { 'submission.workers': req.user._id },
        { 'workItems.doneBy': req.user._id },
      ]
    }

    if (status) filter.status = status

    const bookings = await populateBooking(Booking.find(filter).sort({ createdAt: -1 }))
    res.json({ bookings })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not load bookings' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const booking = await loadBooking(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })
    if (!canView(booking, req.user)) return res.status(403).json({ message: 'Not allowed' })
    res.json({ booking })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not load booking' })
  }
})

router.post('/', authorize('client', 'admin'), async (req, res) => {
  try {
    const {
      serviceId,
      vehicleName,
      vehicleNumber,
      vehicleType,
      notes,
      scheduledDate,
      scheduledTime,
      phone,
      email,
      clientId,
    } = req.body

    if (!serviceId || !scheduledDate || !scheduledTime) {
      return res.status(400).json({ message: 'Service, date and time are required' })
    }
    if (!vehicleName && !vehicleType) {
      return res.status(400).json({ message: 'Vehicle name is required' })
    }

    const service = await Service.findById(serviceId)
    if (!service || !service.isActive) {
      return res.status(404).json({ message: 'Service not available' })
    }

    const client = req.user.role === 'admin' && clientId ? clientId : req.user._id
    const booking = await Booking.create({
      client,
      service: service._id,
      serviceSnapshot: {
        title: service.title,
        price: service.price,
        description: service.description,
        category: service.category,
      },
      vehicleName: vehicleName || vehicleType || '',
      vehicleNumber: vehicleNumber || '',
      vehicleType: vehicleType || vehicleName || '',
      phone: phone || req.user.phone || '',
      email: email || req.user.email || '',
      notes: notes || '',
      scheduledDate,
      scheduledTime,
      workItems: checklistFromService(service),
      statusHistory: [{ status: 'pending', by: req.user._id, note: 'Booking created' }],
    })

    res.status(201).json({ booking: await loadBooking(booking._id) })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not create booking' })
  }
})

async function saveJobImages(req, res, field) {
  const booking = await Booking.findById(req.params.id)
  if (!booking) return res.status(404).json({ message: 'Booking not found' })
  if (closedJob(booking)) return res.status(400).json({ message: 'This booking is already closed' })

  const problem = addJobImages(booking, field, req.files)
  if (problem) return res.status(400).json({ message: problem })

  rememberStaff(booking, req.user._id)
  await booking.save()
  res.json({ booking: await loadBooking(booking._id) })
}

router.post('/:id/before-images', authorize(...FLOOR_ROLES), upload.array('images', 12), async (req, res) => {
  try {
    await saveJobImages(req, res, 'beforeImages')
  } catch (err) {
    res.status(500).json({ message: err.message || 'Upload failed' })
  }
})

router.post('/:id/after-images', authorize(...FLOOR_ROLES), upload.array('images', 12), async (req, res) => {
  try {
    await saveJobImages(req, res, 'afterImages')
  } catch (err) {
    res.status(500).json({ message: err.message || 'Upload failed' })
  }
})

router.delete('/:id/before-images', authorize(...FLOOR_ROLES), async (req, res) => {
  try {
    await dropJobImage(req, res, 'beforeImages')
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not remove the photo' })
  }
})

router.delete('/:id/after-images', authorize(...FLOOR_ROLES), async (req, res) => {
  try {
    await dropJobImage(req, res, 'afterImages')
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not remove the photo' })
  }
})

async function dropJobImage(req, res, field) {
  const booking = await Booking.findById(req.params.id)
  if (!booking) return res.status(404).json({ message: 'Booking not found' })
  if (closedJob(booking)) return res.status(400).json({ message: 'This booking is already closed' })
  if (!removeJobImage(booking, field, req.body.image)) {
    return res.status(404).json({ message: 'Photo not found' })
  }
  await booking.save()
  res.json({ booking: await loadBooking(booking._id) })
}

router.put('/:id/car-accessories', authorize(...FLOOR_ROLES), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })
    if (locked(booking) && req.user.role !== 'admin') {
      return res.status(400).json({ message: 'Intake is locked after submit' })
    }
    if (!booking.beforeImages.length) {
      return res.status(400).json({ message: 'Upload a before image first' })
    }

    const items = Array.isArray(req.body.items) ? req.body.items : null
    if (!items) return res.status(400).json({ message: 'Accessory list is required' })

    const ids = items.map((item) => item.accessoryId).filter(Boolean)
    const catalog = await Accessory.find({ _id: { $in: ids }, isActive: true })
    const byId = new Map(catalog.map((item) => [String(item._id), item]))

    const next = []
    for (const item of items) {
      const catalogItem = item.accessoryId ? byId.get(String(item.accessoryId)) : null
      const name = (catalogItem?.name || item.name || '').trim()
      if (!name) continue
      const previous = (booking.carAccessories || []).find((row) => row.name === name)
      next.push({
        accessoryId: catalogItem?._id,
        name,
        presentBefore: item.presentBefore !== false,
        presentAfter: previous?.presentAfter,
        note: item.note || previous?.note || '',
      })
    }

    booking.carAccessories = next
    booking.intake = {
      saved: true,
      savedAt: new Date(),
      savedBy: req.user._id,
    }
    if (!booking.assignedStaff.some((id) => String(id) === String(req.user._id))) {
      booking.assignedStaff.push(req.user._id)
    }
    if (booking.status === 'pending' || booking.status === 'accepted') {
      pushStatus(booking, 'in_progress', req.user._id, 'Before images and car accessories recorded')
    }
    await booking.save()
    res.json({ booking: await loadBooking(booking._id) })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not save car accessories' })
  }
})

router.patch('/:id/work', authorize(...FLOOR_ROLES), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })
    if (!booking.intake?.saved) {
      return res.status(400).json({ message: 'Save the intake before updating the work' })
    }
    if (locked(booking) && req.user.role !== 'admin') {
      return res.status(400).json({ message: 'Work is locked after submit' })
    }

    const items = req.body.items
    if (req.body.completeAll) {
      for (const row of booking.workItems) {
        row.done = true
        row.doneBy = req.body.doneBy || req.user._id
        row.doneAt = row.doneAt || new Date()
      }
    } else if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Work items are required' })
    } else {
      const staffIds = [...new Set(items.map((item) => item.doneBy).filter(Boolean))]
      const staff = await User.find({ _id: { $in: staffIds }, role: { $in: STAFF_ROLES }, isActive: true })
      const allowed = new Set(staff.map((person) => String(person._id)))

      for (const item of items) {
        const row = booking.workItems.id(item.id)
        if (!row) continue
        row.done = Boolean(item.done)
        if (row.done) {
          const who = item.doneBy && allowed.has(String(item.doneBy)) ? item.doneBy : req.user._id
          row.doneBy = who
          row.doneAt = row.doneAt || new Date()
        } else {
          row.doneBy = undefined
          row.doneAt = undefined
        }
      }
    }

    await booking.save()
    res.json({ booking: await loadBooking(booking._id) })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not update work' })
  }
})

router.patch('/:id/accessory-check', authorize(...FLOOR_ROLES), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })
    if (locked(booking) && req.user.role !== 'admin') {
      return res.status(400).json({ message: 'Accessory check is locked after submit' })
    }

    const items = req.body.items
    if (req.body.checkAll) {
      for (const row of booking.carAccessories) {
        if (row.presentAfter !== true && row.presentAfter !== false) row.presentAfter = true
      }
    } else if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Accessory check is required' })
    }

    for (const item of items || []) {
      const row = booking.carAccessories.id(item.id)
      if (!row) continue
      if (item.presentAfter === true || item.presentAfter === false) row.presentAfter = item.presentAfter
      if (item.note !== undefined) row.note = item.note
    }

    await booking.save()
    res.json({ booking: await loadBooking(booking._id) })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not cross-check accessories' })
  }
})

router.post('/:id/submit', authorize(...FLOOR_ROLES), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })
    if (['billed', 'completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking can no longer be submitted' })
    }
    if (!booking.beforeImages.length) {
      return res.status(400).json({ message: 'Upload a before image before submitting' })
    }
    if (!booking.afterImages.length) {
      return res.status(400).json({ message: 'Upload an after image before submitting' })
    }
    if (!booking.intake?.saved) {
      return res.status(400).json({ message: 'Record the accessories found in the car first' })
    }
    if (!booking.workItems.length || booking.workItems.some((item) => !item.done || !item.doneBy)) {
      return res.status(400).json({ message: 'Mark every included service done and choose who did it' })
    }
    if (booking.carAccessories.some((item) => item.presentAfter !== true && item.presentAfter !== false)) {
      return res.status(400).json({ message: 'Cross-check every accessory before submitting' })
    }

    const workerIds = new Set([
      ...(req.body.workerIds || []).map(String),
      ...booking.workItems.map((item) => String(item.doneBy)),
      String(req.user._id),
    ])
    const workers = await User.find({ _id: { $in: [...workerIds] }, role: { $in: STAFF_ROLES } })

    booking.submission = {
      submitted: true,
      submittedAt: new Date(),
      submittedBy: req.user._id,
      notes: req.body.notes || '',
      workers: workers.map((person) => person._id),
    }
    for (const id of workers.map((person) => person._id)) {
      if (!booking.assignedStaff.some((staffId) => String(staffId) === String(id))) {
        booking.assignedStaff.push(id)
      }
    }
    pushStatus(booking, 'submitted', req.user._id, 'Staff submitted final check')
    await booking.save()
    res.json({ booking: await loadBooking(booking._id) })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not submit the job' })
  }
})

router.patch('/:id/assign', authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })
    const { staffIds } = req.body
    if (!Array.isArray(staffIds)) return res.status(400).json({ message: 'staffIds is required' })
    booking.assignedStaff = staffIds
    await booking.save()
    res.json({ booking: await loadBooking(booking._id) })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not assign staff' })
  }
})

router.post('/:id/invoice', authorize('admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })
    if (!['submitted', 'billed'].includes(booking.status)) {
      return res.status(400).json({ message: 'Generate the bill after staff submit the job' })
    }

    const serviceAmount = Number(booking.serviceSnapshot?.price || 0)
    const extras = Array.isArray(req.body.extras)
      ? req.body.extras
          .filter((line) => line && line.label)
          .map((line) => ({ label: String(line.label), amount: Number(line.amount) || 0 }))
      : []
    const lines = [{ label: booking.serviceSnapshot?.title || 'Service', amount: serviceAmount }, ...extras]
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0)
    const discount = Math.max(0, Number(req.body.discount) || 0)
    const taxPercent = Math.max(0, Number(req.body.taxPercent) || 0)
    const taxable = Math.max(0, subtotal - discount)
    const taxAmount = Math.round((taxable * taxPercent) / 100)
    const total = taxable + taxAmount

    if (!booking.invoice?.number) {
      const count = await Booking.countDocuments({ 'invoice.number': /^GK-/ })
      const year = new Date().getFullYear()
      booking.invoice.number = `GK-${year}-${String(count + 1).padStart(4, '0')}`
    }

    booking.invoice.generatedAt = new Date()
    booking.invoice.generatedBy = req.user._id
    booking.invoice.lines = lines
    booking.invoice.subtotal = subtotal
    booking.invoice.discount = discount
    booking.invoice.taxPercent = taxPercent
    booking.invoice.taxAmount = taxAmount
    booking.invoice.total = total
    booking.invoice.method = req.body.method || booking.invoice.method || 'cash'
    booking.invoice.notes = req.body.notes || ''
    if (req.body.markPaid) {
      booking.invoice.status = 'paid'
      booking.invoice.paidAt = new Date()
    }

    if (booking.status !== 'billed') {
      pushStatus(booking, 'billed', req.user._id, 'Bill generated')
    }
    await booking.save()
    res.json({ booking: await loadBooking(booking._id) })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not generate bill' })
  }
})

router.post('/:id/complete', authorize('admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })
    if (!booking.invoice?.number) {
      return res.status(400).json({ message: 'Generate the bill before completing the booking' })
    }
    if (booking.invoice.status !== 'paid') {
      booking.invoice.status = 'paid'
      booking.invoice.paidAt = new Date()
      if (req.body.method) booking.invoice.method = req.body.method
    }
    booking.completedAt = new Date()
    booking.completedBy = req.user._id
    pushStatus(booking, 'completed', req.user._id, req.body.notes || 'Process completed')
    await booking.save()
    res.json({ booking: await loadBooking(booking._id) })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not complete booking' })
  }
})

router.post('/:id/cancel', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })
    const clientId = booking.client?._id || booking.client
    const isOwner = String(clientId) === String(req.user._id)
    if (req.user.role === 'client' && !isOwner) return res.status(403).json({ message: 'Not your booking' })
    if (req.user.role === 'client' && booking.status !== 'pending') {
      return res.status(400).json({ message: 'Only a pending booking can be cancelled' })
    }
    if (!['admin', 'client'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not allowed' })
    }
    pushStatus(booking, 'cancelled', req.user._id, req.body.notes || 'Cancelled')
    await booking.save()
    res.json({ booking: await loadBooking(booking._id) })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not cancel booking' })
  }
})

export default router
