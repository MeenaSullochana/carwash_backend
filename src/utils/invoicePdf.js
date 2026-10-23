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

  drawRight(page, 'TAX INVOICE', right, height - 46, 10, bold, rgb(0.78, 0.8, 0.84))
  drawRight(page, invoice.number || 'Invoice', right, height - 68, 14, bold, white)
  drawRight(page, formatDate(invoice.generatedAt), right, height - 88, 10, font, rgb(0.78, 0.8, 0.84))

  let y = height - headerH - 28
  const contact = `${studio.place} studio   ·   ${studio.phone}   ·   ${studio.email}`
  page.drawText(contact, { x: margin, y, size: 10, font, color: silver })
  y -= 16
  for (const row of wrap(studio.address, font, 10, width - margin * 2).slice(0, 2)) {
    page.drawText(row, { x: margin, y, size: 10, font, color: mist })
    y -= 14
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
    page.drawText(title, { x, y: cardTop - 20, size: 10, font: bold, color: accent })
    let lineY = cardTop - 40
    lines.slice(0, 4).forEach((row, index) => {
      page.drawText(row, {
        x,
        y: lineY,
        size: 10,
        font: index === 0 ? bold : font,
        color: index === 0 ? ink : silver,
      })
      lineY -= 16
    })
  }
  writeCard('BILL TO', customerLines, margin + 16)
  writeCard('VEHICLE', vehicleLines, margin + cardW + 30)

  y = cardTop - cardH - 26
  const lines = (invoice.lines || []).filter((item) => item && (item.label || item.amount !== undefined))
  const rows = lines.length
    ? lines
    : [{ label: booking.serviceSnapshot?.title || 'Service', amount: invoice.total }]

  const headH = 28
  page.drawRectangle({ x: margin, y: y - headH, width: width - margin * 2, height: headH, color: ink })
  page.drawText('Description', { x: margin + 14, y: y - 18, size: 10, font: bold, color: white })
  drawRight(page, 'Amount', right - 14, y - 18, 10, bold, white)
  y -= headH

  rows.forEach((item, index) => {
    const description = wrap(item.label || 'Service', font, 10, 340).slice(0, 2)
    const rowH = description.length > 1 ? 40 : 28
    if (index % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - rowH, width: width - margin * 2, height: rowH, color: cloud })
    }
    description.forEach((row, rowIndex) => {
      page.drawText(row, { x: margin + 14, y: y - 18 - rowIndex * 14, size: 10, font, color: ink })
    })
    drawRight(page, money(item.amount), right - 14, y - 18, 10, bold, ink)
    y -= rowH
  })

  y -= 22
  const totals = [
    ['Subtotal', money(invoice.subtotal)],
    ['Discount', money(invoice.discount)],
    [`Tax (${invoice.taxPercent || 0}%)`, money(invoice.taxAmount)],
  ]
  const boxW = 240
  const boxX = right - boxW
  const rowGap = 20
  const summaryH = 16 + totals.length * rowGap
  page.drawRectangle({
    x: boxX,
    y: y - summaryH,
    width: boxW,
    height: summaryH,
    color: cloud,
  })

  let rowY = y - 18
  for (const [label, amount] of totals) {
    page.drawText(label, { x: boxX + 16, y: rowY, size: 10, font, color: silver })
    drawRight(page, amount, right - 16, rowY, 10, font, ink)
    rowY -= rowGap
  }

  const barH = 34
  const barY = y - summaryH - barH
  page.drawRectangle({ x: boxX, y: barY, width: boxW, height: barH, color: ink })
  page.drawText('Total', { x: boxX + 16, y: barY + 12, size: 10, font: bold, color: white })
  drawRight(page, money(invoice.total), right - 16, barY + 12, 10, bold, white)

  const paid = invoice.status === 'paid'
  const status = paid ? 'PAID' : 'UNPAID'
  const badgeW = bold.widthOfTextAtSize(status, 10) + 20
  page.drawRectangle({
    x: margin,
    y: y - 22,
    width: badgeW,
    height: 20,
    color: paid ? paidGreen : accent,
  })
  page.drawText(status, { x: margin + 10, y: y - 16, size: 10, font: bold, color: white })
  if (invoice.method) {
    page.drawText(clean(invoice.method).toUpperCase(), {
      x: margin + badgeW + 10,
      y: y - 16,
      size: 10,
      font,
      color: silver,
    })
  }
  if (invoice.notes) {
    let noteY = y - 48
    page.drawText('Note', { x: margin, y: noteY, size: 10, font: bold, color: accent })
    noteY -= 16
    for (const row of wrap(invoice.notes, font, 10, boxX - margin - 24).slice(0, 4)) {
      page.drawText(row, { x: margin, y: noteY, size: 10, font, color: silver })
      noteY -= 14
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
  const footerNote = wrap(
    'Payment is collected after you inspect the car. This is a computer-generated invoice.',
    font,
    10,
    width - margin * 2,
  )
  footerNote.forEach((row, index) => {
    page.drawText(row, {
      x: margin,
      y: 20 - index * 12,
      size: 10,
      font,
      color: rgb(0.75, 0.77, 0.8),
    })
  })

  return Buffer.from(await pdf.save())
}
