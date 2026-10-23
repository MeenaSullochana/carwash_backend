import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logoPath = path.join(__dirname, '../../assets/geekay-logo.png')

const ink = rgb(0.055, 0.063, 0.09)
const accent = rgb(0.937, 0.169, 0.208)
const white = rgb(1, 1, 1)
const mist = rgb(0.45, 0.48, 0.53)
const silver = rgb(0.28, 0.3, 0.34)
const line = rgb(0.9, 0.91, 0.93)
const cloud = rgb(0.965, 0.968, 0.975)
const paidGreen = rgb(0.09, 0.48, 0.32)

const studio = {
  name: 'Geekay Klean Kare',
  place: 'Sriperumbudur',
  phone: '+91 98765 43210',
  email: 'hello@luxoraauto.com',
  address: 'SF No. 356/6A3A, Sri Vasuvui Nagar, Sungavarchatram, SIPCOT Industrial Park, Sriperumbudur.',
}

function clean(value) {
  return String(value ?? '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function money(amount) {
  const value = Number(amount || 0)
  return `Rs ${value.toLocaleString('en-IN')}`
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return clean(value)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatSlot(date, time) {
  const day = date ? formatDate(`${date}T00:00:00`) : ''
  return [day || clean(date), clean(time)].filter(Boolean).join('  ·  ')
}

function wrap(text, font, size, maxWidth) {
  const words = clean(text).split(' ').filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next
    else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawRight(page, text, right, y, size, font, color) {
  const label = clean(text)
  const width = font.widthOfTextAtSize(label, size)
  page.drawText(label, { x: right - width, y, size, font, color })
}

export async function buildInvoicePdf(booking) {
  const invoice = booking.invoice || {}
  const client = booking.client || {}
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const { width, height } = page.getSize()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const logo = await pdf.embedPng(fs.readFileSync(logoPath))

  const margin = 40
  const right = width - margin
  const headerH = 132

  page.drawRectangle({ x: 0, y: height - headerH, width, height: headerH, color: ink })
  page.drawRectangle({ x: 0, y: height - headerH - 6, width, height: 6, color: accent })

  const logoW = 210
  const logoH = (logo.height / logo.width) * logoW
  page.drawImage(logo, {
    x: margin - 6,
    y: height - 24 - logoH,
    width: logoW,
    height: logoH,
  })

  drawRight(page, 'TAX INVOICE', right, height - 48, 9, bold, rgb(0.78, 0.8, 0.84))
  drawRight(page, invoice.number || 'Invoice', right, height - 72, 16, bold, white)
  drawRight(page, formatDate(invoice.generatedAt), right, height - 92, 10, font, rgb(0.78, 0.8, 0.84))

  let y = height - headerH - 30
  const contact = `${studio.place} studio   ·   ${studio.phone}   ·   ${studio.email}`
  page.drawText(contact, { x: margin, y, size: 9, font, color: silver })
  y -= 14
  for (const row of wrap(studio.address, font, 8.5, width - margin * 2).slice(0, 2)) {
    page.drawText(row, { x: margin, y, size: 8.5, font, color: mist })
    y -= 12
  }

  y -= 16
  const cardTop = y
  const cardH = 96
  const cardW = (width - margin * 2 - 14) / 2
  page.drawRectangle({ x: margin, y: cardTop - cardH, width: cardW, height: cardH, color: cloud })
  page.drawRectangle({ x: margin + cardW + 14, y: cardTop - cardH, width: cardW, height: cardH, color: cloud })

  const customerLines = [
    clean(client.name) || 'Customer',
    clean(client.phone || booking.phone),
    clean(booking.email || client.email),
    clean(booking.bookingCode),
  ].filter(Boolean)
  const vehicleLines = [
    clean([booking.vehicleName || booking.vehicleType, booking.vehicleNumber].filter(Boolean).join('   ')),
    formatSlot(booking.scheduledDate, booking.scheduledTime),
    clean(booking.serviceSnapshot?.title),
  ].filter(Boolean)

  const writeCard = (title, lines, x) => {
    page.drawText(title, { x, y: cardTop - 18, size: 8, font: bold, color: accent })
    let lineY = cardTop - 38
    lines.slice(0, 4).forEach((row, index) => {
      page.drawText(row, {
        x,
        y: lineY,
        size: index === 0 ? 12 : 9.5,
        font: index === 0 ? bold : font,
        color: index === 0 ? ink : silver,
      })
      lineY -= index === 0 ? 18 : 13
    })
  }
  writeCard('BILL TO', customerLines, margin + 16)
  writeCard('VEHICLE', vehicleLines, margin + cardW + 30)

  y = cardTop - cardH - 28
  const lines = (invoice.lines || []).filter((item) => item && (item.label || item.amount !== undefined))
  const rows = lines.length
    ? lines
    : [{ label: booking.serviceSnapshot?.title || 'Service', amount: invoice.total }]

  page.drawRectangle({ x: margin, y: y - 8, width: width - margin * 2, height: 28, color: ink })
  page.drawText('DESCRIPTION', { x: margin + 14, y: y, size: 8, font: bold, color: white })
  drawRight(page, 'AMOUNT', right - 14, y, 8, bold, white)
  y -= 28

  rows.forEach((item, index) => {
    const description = wrap(item.label || 'Service', font, 11, 340).slice(0, 2)
    const rowH = Math.max(30, 16 + description.length * 14)
    if (index % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - rowH + 16, width: width - margin * 2, height: rowH, color: cloud })
    }
    description.forEach((row, rowIndex) => {
      page.drawText(row, { x: margin + 14, y: y - rowIndex * 13, size: 11, font, color: ink })
    })
    drawRight(page, money(item.amount), right - 14, y, 11, bold, ink)
    y -= rowH
  })

  y -= 18
  const totals = [
    ['Subtotal', money(invoice.subtotal)],
    ['Discount', money(invoice.discount)],
    [`Tax (${invoice.taxPercent || 0}%)`, money(invoice.taxAmount)],
  ]
  const boxW = 230
  const boxX = right - boxW
  const boxH = 28 + totals.length * 18 + 36
  page.drawRectangle({ x: boxX, y: y - boxH + 22, width: boxW, height: boxH, color: cloud })

  let totalY = y
  for (const [label, amount] of totals) {
    page.drawText(label, { x: boxX + 16, y: totalY, size: 10, font, color: silver })
    drawRight(page, amount, right - 16, totalY, 10, font, ink)
    totalY -= 18
  }
  page.drawRectangle({ x: boxX, y: totalY - 8, width: boxW, height: 32, color: ink })
  page.drawText('TOTAL', { x: boxX + 16, y: totalY + 2, size: 11, font: bold, color: white })
  drawRight(page, money(invoice.total), right - 16, totalY + 2, 13, bold, white)

  const paid = invoice.status === 'paid'
  const status = paid ? 'PAID' : 'UNPAID'
  const badgeW = bold.widthOfTextAtSize(status, 9) + 22
  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: badgeW,
    height: 20,
    color: paid ? paidGreen : accent,
  })
  page.drawText(status, { x: margin + 11, y: y + 1, size: 9, font: bold, color: white })
  if (invoice.method) {
    page.drawText(clean(invoice.method), { x: margin + badgeW + 10, y: y + 1, size: 10, font, color: silver })
  }
  if (invoice.notes) {
    let noteY = y - 28
    page.drawText('NOTE', { x: margin, y: noteY, size: 8, font: bold, color: accent })
    noteY -= 14
    for (const row of wrap(invoice.notes, font, 9.5, 280).slice(0, 4)) {
      page.drawText(row, { x: margin, y: noteY, size: 9.5, font, color: silver })
      noteY -= 13
    }
  }

  page.drawRectangle({ x: 0, y: 0, width, height: 64, color: ink })
  page.drawRectangle({ x: 0, y: 64, width, height: 4, color: accent })
  page.drawText('Thank you for trusting Geekay Klean Kare.', {
    x: margin,
    y: 36,
    size: 10,
    font: bold,
    color: white,
  })
  page.drawText('Payment is collected after you inspect the car. This is a computer-generated invoice.', {
    x: margin,
    y: 20,
    size: 8,
    font,
    color: rgb(0.75, 0.77, 0.8),
  })

  return Buffer.from(await pdf.save())
}
