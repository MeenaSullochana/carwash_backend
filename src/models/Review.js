import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, sparse: true, trim: true },
    quote: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    car: { type: String, default: '', trim: true },
    service: { type: String, default: '', trim: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    featured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const Review = mongoose.model('Review', reviewSchema)
