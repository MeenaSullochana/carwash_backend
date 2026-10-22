import mongoose from 'mongoose'

const accessorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: 'Cabin' },
    description: { type: String, default: '' },
    price: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const Accessory = mongoose.model('Accessory', accessorySchema)
