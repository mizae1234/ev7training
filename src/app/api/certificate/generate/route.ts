import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { maskNationalId } from '@/lib/utils'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cert = await prisma.certificate.findFirst({
    where: { driver_id: session.user.id, status: 'VALID' },
    include: { driver: true },
    orderBy: { issued_at: 'desc' },
  })

  if (!cert) {
    return NextResponse.json({ error: 'No certificate' }, { status: 404 })
  }

  // Generate PDF
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()

  const fontRegularBytes = fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', 'Kanit-Regular.ttf'))
  const fontMediumBytes = fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', 'Kanit-Medium.ttf'))

  const font = await pdfDoc.embedFont(fontRegularBytes)
  const fontBold = await pdfDoc.embedFont(fontMediumBytes)

  // Colors
  const green = rgb(0.02, 0.59, 0.41) // EV7 green
  const darkGreen = rgb(0.01, 0.37, 0.27)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.9, 0.9, 0.9)
  const white = rgb(1, 1, 1)

  // Background gradient effect - green header
  page.drawRectangle({
    x: 0,
    y: height - 200,
    width,
    height: 200,
    color: green,
  })

  // Header text
  page.drawText('EV7', {
    x: 50,
    y: height - 80,
    size: 48,
    font: fontBold,
    color: white,
  })

  page.drawText('DRIVER TRAINING CERTIFICATE', {
    x: 50,
    y: height - 110,
    size: 14,
    font,
    color: rgb(0.9, 0.95, 0.9),
  })

  // Certificate body
  const bodyY = height - 260

  page.drawText('Certificate of Completion', {
    x: width / 2 - font.widthOfTextAtSize('Certificate of Completion', 24) / 2,
    y: bodyY,
    size: 24,
    font: fontBold,
    color: darkGreen,
  })

  page.drawText('This certifies that', {
    x: width / 2 - font.widthOfTextAtSize('This certifies that', 12) / 2,
    y: bodyY - 40,
    size: 12,
    font,
    color: gray,
  })

  // Name
  const name = cert.driver.full_name
  page.drawText(name, {
    x: width / 2 - fontBold.widthOfTextAtSize(name, 28) / 2,
    y: bodyY - 80,
    size: 28,
    font: fontBold,
    color: darkGreen,
  })

  // Line under name
  page.drawLine({
    start: { x: 100, y: bodyY - 90 },
    end: { x: width - 100, y: bodyY - 90 },
    thickness: 1,
    color: lightGray,
  })

  page.drawText('has successfully completed the EV7 Driver Training Program', {
    x: width / 2 - font.widthOfTextAtSize('has successfully completed the EV7 Driver Training Program', 12) / 2,
    y: bodyY - 120,
    size: 12,
    font,
    color: gray,
  })

  // Details
  const detailsY = bodyY - 180
  const details = [
    ['National ID', maskNationalId(cert.driver.national_id)],
    ['Score', `${Math.round(cert.score)}%`],
    ['Date', cert.issued_at.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })],
    ['Certificate No.', cert.certificate_no],
  ]

  details.forEach(([label, value], i) => {
    const y = detailsY - i * 30
    page.drawText(`${label}:`, { x: 150, y, size: 11, font, color: gray })
    page.drawText(value, { x: 300, y, size: 11, font: fontBold, color: darkGreen })
  })

  // QR Code
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const verifyUrl = `${appUrl}/verify/${cert.certificate_no}`
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 120, margin: 1 })
  const qrImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
  const qrImage = await pdfDoc.embedPng(qrImageBytes)

  page.drawImage(qrImage, {
    x: width / 2 - 55,
    y: 100,
    width: 110,
    height: 110,
  })

  page.drawText('Scan to verify', {
    x: width / 2 - font.widthOfTextAtSize('Scan to verify', 9) / 2,
    y: 85,
    size: 9,
    font,
    color: gray,
  })

  // Footer
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: 50,
    color: green,
  })

  page.drawText('EV7 Taxi | Driver Onboarding System', {
    x: width / 2 - font.widthOfTextAtSize('EV7 Taxi | Driver Onboarding System', 10) / 2,
    y: 18,
    size: 10,
    font,
    color: white,
  })

  const pdfBytes = await pdfDoc.save()

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="EV7-Certificate-${cert.certificate_no}.pdf"`,
    },
  })
}
