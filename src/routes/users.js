import { Router } from 'express'
import { User } from '../models/User.js'
import { authorize, protect } from '../middleware/auth.js'

const router = Router()

router.use(protect)

router.get('/', authorize('admin', 'supervisor', 'staff', 'washer'), async (req, res) => {
  const { role } = req.query
  const filter = {}
  if (role) {
    filter.role = role === 'staff' ? { $in: ['staff', 'washer'] } : role
  } else if (['supervisor', 'staff', 'washer'].includes(req.user.role)) {
    filter.role = { $in: ['staff', 'washer', 'supervisor'] }
  }

  const users = await User.find(filter).sort({ createdAt: -1 })
  res.json({ users: users.map((u) => u.toSafeJSON()) })
})

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password and role are required' })
    }
    if (!['admin', 'supervisor', 'staff', 'washer', 'client'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' })
    }

    const exists = await User.findOne({ email: email.toLowerCase() })
    if (exists) return res.status(409).json({ message: 'Email already registered' })

    const user = await User.create({ name, email, phone: phone || '', password, role })
    res.status(201).json({ user: user.toSafeJSON() })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not create user' })
  }
})

router.patch('/:id', authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const { name, phone, role, isActive, password } = req.body
    if (name !== undefined) user.name = name
    if (phone !== undefined) user.phone = phone
    if (role !== undefined) user.role = role
    if (isActive !== undefined) user.isActive = isActive
    if (password) user.password = password

    await user.save()
    res.json({ user: user.toSafeJSON() })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not update user' })
  }
})

export default router
