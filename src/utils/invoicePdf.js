function pdfText(value) {
  return String(value ?? '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function rupees(amount) {
  const value = Number(amount || 0)
  return `Rs ${value.toLocaleString('en-IN')}`
}

function drawText(ops, text, x, y, size, font = 'F1') {
  ops.push(`BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfText(text)}) Tj ET`)
}

export function buildInvoicePdf(booking) {
  const invoice = booking.invoice || {}
  const client = booking.client || {}
  const ops = []
  let y = 790

  drawText(ops, 'GEEKAY KLEAN KARE', 48, y, 18, 'F2')
  y -= 22
  drawText(ops, 'Sriperumbudur  |  Tax invoice', 48, y, 10)
  y -= 28
  drawText(ops, invoice.number || 'Invoice', 48, y, 16, 'F2')
  const issued = invoice.generatedAt ? new Date(invoice.generatedAt).toLocaleDateString('en-IN') : ''
  drawText(ops, issued, 430, y, 11)
  y -= 28

  drawText(ops, 'Customer', 48, y, 9)
  drawText(ops, 'Vehicle', 320, y, 9)
  y -= 16
  drawText(ops, client.name || 'Customer', 48, y, 12, 'F2')
  drawText(ops, [booking.vehicleName || booking.vehicleType, booking.vehicleNumber].filter(Boolean).join('  '), 320, y, 12, 'F2')
  y -= 16
  drawText(ops, client.phone || booking.phone || '', 48, y, 10)
  drawText(ops, `${booking.scheduledDate || ''}  ${booking.scheduledTime || ''}`.trim(), 320, y, 10)
  y -= 14
  drawText(ops, booking.bookingCode || '', 48, y, 10)
  y -= 22

  ops.push('0.85 0.88 0.93 RG')
  ops.push(`48 ${y} m 547 ${y} l S`)
  y -= 18
  drawText(ops, 'DESCRIPTION', 48, y, 9)
  drawText(ops, 'AMOUNT', 470, y, 9)
  y -= 8
  ops.push(`48 ${y} m 547 ${y} l S`)
  ops.push('0 0 0 RG')
  y -= 20

  for (const line of invoice.lines || []) {
    drawText(ops, line.label || 'Service', 48, y, 11)
    drawText(ops, rupees(line.amount), 430, y, 11)
    y -= 18
  }

  y -= 8
  ops.push('0.85 0.88 0.93 RG')
  ops.push(`300 ${y} m 547 ${y} l S`)
  ops.push('0 0 0 RG')
  y -= 20

  const totals = [
    ['Subtotal', rupees(invoice.subtotal)],
    ['Discount', rupees(invoice.discount)],
    [`Tax (${invoice.taxPercent || 0}%)`, rupees(invoice.taxAmount)],
  ]
  for (const [label, amount] of totals) {
    drawText(ops, label, 320, y, 11)
    drawText(ops, amount, 430, y, 11)
    y -= 16
  }
  y -= 4
  drawText(ops, 'Total', 320, y, 14, 'F2')
  drawText(ops, rupees(invoice.total), 430, y, 14, 'F2')
  y -= 28

  const status = invoice.status === 'paid' ? 'Paid' : 'Unpaid'
  drawText(ops, [status, invoice.method].filter(Boolean).join('  ·  '), 48, y, 11, 'F2')
  if (invoice.notes) {
    y -= 16
    drawText(ops, invoice.notes, 48, y, 10)
  }

  const stream = ops.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ]

  let body = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body))
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefAt = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n`
  body += '0000000000 65535 f \n'
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`
  return Buffer.from(body)
}
