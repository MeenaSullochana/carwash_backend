import { Router } from 'express'
import { User } from '../models/User.js'
import { protect, signToken } from '../middleware/auth.js'

const router = Router()

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' })
    }

    const exists = await User.findOne({ email: email.toLowerCase() })
    if (exists) {
      return res.status(409).json({ message: 'Email already registered' })
    }

    const user = await User.create({
      name,
      email,
      phone: phone || '',
      password,
      role: 'client',
    })

    const token = signToken(user)
    res.status(201).json({ token, user: user.toSafeJSON() })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Registration failed' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is inactive' })
    }

    const token = signToken(user)
    res.json({ token, user: user.toSafeJSON() })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Login failed' })
  }
})

router.get('/me', protect, (req, res) => {
  res.json({ user: req.user.toSafeJSON() })
})

router.patch('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' })
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' })
    }

    const user = await User.findById(req.user._id)
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: 'Current password is incorrect' })
    }

    user.password = newPassword
    await user.save()
    res.json({ message: 'Password updated' })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not update password' })
  }
})

export default router
