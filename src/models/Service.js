import mongoose from 'mongoose'

const stepSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: true },
)

const serviceSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true, sparse: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, default: 60 },
    image: { type: String, default: '' },
    category: { type: String, enum: ['service', 'package'], default: 'service' },
    steps: [stepSchema],
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export const Service = mongoose.model('Service', serviceSchema)
