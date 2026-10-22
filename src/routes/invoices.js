import { Router } from 'express'
import { Booking } from '../models/Booking.js'
import { protect } from '../middleware/auth.js'
import { buildInvoicePdf } from '../utils/invoicePdf.js'

const router = Router()

router.use(protect)

router.get('/', async (req, res) => {
  try {
    const filter = { 'invoice.number': { $nin: ['', null] } }
    if (req.user.role === 'client') filter.client = req.user._id
    if (!['admin', 'supervisor', 'staff', 'washer', 'client'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not allowed' })
    }

    const bookings = await Booking.find(filter)
      .sort({ 'invoice.generatedAt': -1 })
      .populate('client', 'name email phone')
      .populate('service', 'title')
      .select('bookingCode client service serviceSnapshot scheduledDate scheduledTime status invoice vehicleName vehicleNumber')

    res.json({
      invoices: bookings.map((booking) => ({
        bookingId: booking._id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        client: booking.client,
        service: booking.serviceSnapshot?.title || booking.service?.title,
        vehicleName: booking.vehicleName,
        vehicleNumber: booking.vehicleNumber,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        invoice: booking.invoice,
      })),
    })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not load invoices' })
  }
})

router.get('/:bookingId/download', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId).populate('client', 'name email phone')
    if (!booking?.invoice?.number) {
      return res.status(404).json({ message: 'Invoice not found' })
    }

    const clientId = booking.client?._id || booking.client
    const ownsInvoice = req.user.role === 'client' && String(clientId) === String(req.user._id)
    if (!ownsInvoice && !['admin', 'supervisor'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not allowed' })
    }

    const pdf = buildInvoicePdf(booking)
    const filename = `${booking.invoice.number}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdf)
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not download invoice' })
  }
})

export default router
