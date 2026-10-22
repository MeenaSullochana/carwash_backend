import { Router } from 'express'
import { Accessory } from '../models/Accessory.js'
import { authorize, protect } from '../middleware/auth.js'

const router = Router()

router.get('/', protect, async (req, res) => {
  const filter = req.query.all === '1' ? {} : { isActive: true }
  const accessories = await Accessory.find(filter).sort({ name: 1 })
  res.json({ accessories })
})

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, price, description, category, isActive } = req.body
    if (!name) {
      return res.status(400).json({ message: 'Name is required' })
    }
    const accessory = await Accessory.create({
      name,
      category: category || 'Cabin',
      price: Number(price) || 0,
      description: description || '',
      isActive: isActive !== false,
    })
    res.status(201).json({ accessory })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not create accessory' })
  }
})

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const accessory = await Accessory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!accessory) return res.status(404).json({ message: 'Accessory not found' })
    res.json({ accessory })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not update accessory' })
  }
})

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  const accessory = await Accessory.findByIdAndDelete(req.params.id)
  if (!accessory) return res.status(404).json({ message: 'Accessory not found' })
  res.json({ message: 'Accessory deleted' })
})

export default router
