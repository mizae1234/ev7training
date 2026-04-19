import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''

  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { full_name: { contains: search, mode: 'insensitive' } },
      { national_id: { contains: search } },
      { case_id: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (status && status !== 'all') {
    where.onboarding_status = status
  }

  const drivers = await prisma.driver.findMany({
    where: where as any,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      case_id: true,
      full_name: true,
      national_id: true,
      phone: true,
      car_model: true,
      project_type: true,
      status: true,
      onboarding_status: true,
      created_at: true,
    },
  })

  return NextResponse.json({ drivers })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { full_name, national_id, date_of_birth, phone, project_type, case_id, car_model } = body

  if (!full_name || !national_id || !date_of_birth) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })
  }

  if (national_id.length !== 13) {
    return NextResponse.json({ error: 'เลขบัตรประชาชนต้องมี 13 หลัก' }, { status: 400 })
  }

  const existing = await prisma.driver.findUnique({ where: { national_id } })
  if (existing) {
    return NextResponse.json({ error: 'เลขบัตรประชาชนนี้มีในระบบแล้ว' }, { status: 400 })
  }

  const driver = await prisma.driver.create({
    data: {
      case_id: case_id || null,
      full_name,
      national_id,
      date_of_birth: new Date(date_of_birth),
      phone: phone || null,
      car_model: car_model || null,
      project_type: project_type || null,
    },
  })

  return NextResponse.json(driver, { status: 201 })
}
