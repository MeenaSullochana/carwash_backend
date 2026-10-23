import mongoose from 'mongoose'

const galleryItemSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, sparse: true, trim: true },
    title: { type: String, required: true, trim: true },
    service: { type: String, default: '', trim: true },
    category: { type: String, default: 'Exterior', trim: true },
    image: { type: String, default: '' },
    alt: { type: String, default: '' },
    span: { type: String, enum: ['normal', 'wide', 'tall', 'feature'], default: 'normal' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const GalleryItem = mongoose.model('GalleryItem', galleryItemSchema)
