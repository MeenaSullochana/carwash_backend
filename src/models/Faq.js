import mongoose from 'mongoose'

const faqSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, sparse: true, trim: true },
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    showOnHome: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const Faq = mongoose.model('Faq', faqSchema)
