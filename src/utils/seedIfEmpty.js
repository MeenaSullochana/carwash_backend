import { User } from '../models/User.js'

const demoUsers = [
  {
    name: 'Admin Geekay',
    email: 'admin@luxora.com',
    phone: '+919876543210',
    password: 'admin123',
    role: 'admin',
  },
  {
    name: 'Riya Supervisor',
    email: 'supervisor@luxora.com',
    phone: '+919876543211',
    password: 'super123',
    role: 'supervisor',
  },
  {
    name: 'Arun Staff',
    email: 'washer1@luxora.com',
    phone: '+919876543212',
    password: 'wash123',
    role: 'staff',
  },
  {
    name: 'Vikram Staff',
    email: 'washer2@luxora.com',
    phone: '+919876543213',
    password: 'wash123',
    role: 'staff',
  },
  {
    name: 'Demo Client',
    email: 'client@luxora.com',
    phone: '+919876543214',
    password: 'client123',
    role: 'client',
  },
]

export async function seedIfEmpty() {
  const count = await User.countDocuments()
  if (count > 0) return
  await User.create(demoUsers)
  console.log('Demo accounts ready')
  console.log('  admin@luxora.com / admin123')
  console.log('  supervisor@luxora.com / super123')
  console.log('  washer1@luxora.com / wash123')
  console.log('  client@luxora.com / client123')
}
