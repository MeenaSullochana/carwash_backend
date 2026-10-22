import mongoose from 'mongoose'

const workItemSchema = new mongoose.Schema(
  {
    stepId: { type: mongoose.Schema.Types.ObjectId },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    done: { type: Boolean, default: false },
    doneAt: { type: Date },
    doneBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true },
)

const carAccessorySchema = new mongoose.Schema(
  {
    accessoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Accessory' },
    name: { type: String, required: true },
    presentBefore: { type: Boolean, default: true },
    presentAfter: { type: Boolean },
    note: { type: String, default: '' },
  },
  { _id: true },
)

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: { type: String, unique: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceSnapshot: {
      title: String,
      price: Number,
      description: String,
      category: String,
    },
    vehicleName: { type: String, default: '' },
    vehicleNumber: { type: String, default: '' },
    vehicleType: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    notes: { type: String, default: '' },
    scheduledDate: { type: String, required: true },
    scheduledTime: { type: String, required: true },
    status: {
      type: String,
      enum: [
        'pending',
        'in_progress',
        'submitted',
        'billed',
        'completed',
        'cancelled',
        'accepted',
        'quality_check',
        'payment_pending',
        'ready_handover',
      ],
      default: 'pending',
    },
    beforeImages: [{ type: String }],
    afterImages: [{ type: String }],
    carAccessories: [carAccessorySchema],
    assignedStaff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    workItems: [workItemSchema],
    intake: {
      saved: { type: Boolean, default: false },
      savedAt: { type: Date },
      savedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    submission: {
      submitted: { type: Boolean, default: false },
      submittedAt: { type: Date },
      submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      notes: { type: String, default: '' },
      workers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    invoice: {
      number: { type: String, default: '' },
      generatedAt: { type: Date },
      generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      lines: [
        {
          label: String,
          amount: Number,
        },
      ],
      subtotal: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      taxPercent: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      method: { type: String, default: '' },
      status: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
      paidAt: { type: Date },
      notes: { type: String, default: '' },
    },
    completedAt: { type: Date },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    statusHistory: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String,
      },
    ],
  },
  { timestamps: true },
)

bookingSchema.pre('save', function ensureCode(next) {
  if (!this.bookingCode) {
    const stamp = Date.now().toString(36).toUpperCase()
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
    this.bookingCode = `GK-${stamp}-${rand}`
  }
  next()
})

export const Booking = mongoose.model('Booking', bookingSchema)
