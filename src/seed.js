import 'dotenv/config'
import { connectDB } from './utils/db.js'
import { ensureCatalog } from './utils/ensureCatalog.js'
import { User } from './models/User.js'
import { Service } from './models/Service.js'
import { Accessory } from './models/Accessory.js'
import { Booking } from './models/Booking.js'

await connectDB(process.env.MONGODB_URI)
await Promise.all([
  User.deleteMany({}),
  Service.deleteMany({}),
  Accessory.deleteMany({}),
  Booking.deleteMany({}),
])

await User.create([
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
])

await ensureCatalog()
console.log('Seed complete')
console.log('  admin@luxora.com / admin123')
console.log('  washer1@luxora.com / wash123')
console.log('  client@luxora.com / client123')
process.exit(0)
