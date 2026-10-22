import 'dotenv/config'
import fs from 'fs'
import cors from 'cors'
import express from 'express'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { connectDB } from './utils/db.js'
import { seedIfEmpty } from './utils/seedIfEmpty.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import serviceRoutes from './routes/services.js'
import accessoryRoutes from './routes/accessories.js'
import bookingRoutes from './routes/bookings.js'
import invoiceRoutes from './routes/invoices.js'
import { ensureCatalog } from './utils/ensureCatalog.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(__dirname, '../../frontend')
const frontendDist = path.join(frontendRoot, 'dist')
const isProd = process.env.NODE_ENV === 'production'

const app = express()
const port = process.env.PORT || 5000

const clientOrigins = [
  'https://gkkleankare.netlify.app',
  'http://localhost:5000',
  'http://localhost:5173',
  'http://localhost:5174',
]
for (const extra of [process.env.CLIENT_URL, process.env.ADMIN_URL]) {
  if (extra && !clientOrigins.includes(extra)) clientOrigins.push(extra)
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || clientOrigins.includes(origin)) return callback(null, true)
      callback(null, false)
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'luxora-carwash-api' })
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/accessories', accessoryRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/invoices', invoiceRoutes)

await connectDB(process.env.MONGODB_URI)
await seedIfEmpty()
await ensureCatalog()

if (isProd) {
  app.use(express.static(frontendDist))
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) next(err)
    })
  })
} else {
  // Dev: Vite middleware — website + admin + API on one port
  const vitePkg = path.join(frontendRoot, 'node_modules/vite/dist/node/index.js')
  const { createServer: createViteServer } = await import(pathToFileURL(vitePkg).href)
  const vite = await createViteServer({
    root: frontendRoot,
    configFile: path.join(frontendRoot, 'vite.config.js'),
    server: { middlewareMode: true },
    appType: 'custom',
  })
  app.use(vite.middlewares)
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    try {
      const url = req.originalUrl
      let template = fs.readFileSync(path.join(frontendRoot, 'index.html'), 'utf-8')
      template = await vite.transformIndexHtml(url, template)
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template)
    } catch (err) {
      vite.ssrFixStacktrace?.(err)
      next(err)
    }
  })
}

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ message: err.message || 'Server error' })
})

app.listen(port, () => {
  console.log(`Geekay Klean Kare running on http://localhost:${port}`)
  console.log(`  Website  → http://localhost:${port}/`)
  console.log(`  Admin    → http://localhost:${port}/admin`)
  console.log(`  API      → http://localhost:${port}/api`)
})
