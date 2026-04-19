import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const certificates = await prisma.certificate.findMany({
    include: { driver: { select: { full_name: true, national_id: true, case_id: true, car_model: true } } },
    orderBy: { issued_at: 'desc' },
  })
  return NextResponse.json({ certificates })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, action, reason } = body

  if (action === 'revoke') {
    const cert = await prisma.certificate.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revoked_at: new Date(),
        revoked_reason: reason || 'เพิกถอนโดยแอดมิน',
      },
    })
    return NextResponse.json(cert)
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
