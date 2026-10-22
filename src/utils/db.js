import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let memoryServer

export async function connectDB(uri) {
  mongoose.set('strictQuery', true)

  const preferMemory = process.env.USE_MEMORY_DB === '1'
  const targetUri = uri || 'mongodb://127.0.0.1:27017/luxora_carwash'

  if (!preferMemory) {
    try {
      await mongoose.connect(targetUri, { serverSelectionTimeoutMS: 15000, family: 4 })
      console.log('MongoDB connected')
      return
    } catch (err) {
      console.warn('MongoDB unavailable, starting in-memory MongoDB…')
      console.warn(err.message)
    }
  }

  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'luxora_carwash',
      launchTimeout: 120000,
    },
  })
  const memUri = memoryServer.getUri()
  await mongoose.connect(memUri)
  console.log('In-memory MongoDB connected (demo mode)')
}

export async function stopMemoryDB() {
  await mongoose.disconnect()
  if (memoryServer) await memoryServer.stop()
}
