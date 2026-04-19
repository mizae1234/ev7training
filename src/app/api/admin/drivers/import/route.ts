import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { drivers } = body

  if (!Array.isArray(drivers) || drivers.length === 0) {
    return NextResponse.json({ error: 'No data' }, { status: 400 })
  }

  let success = 0
  let failed = 0
  const errors: { row: number; error: string }[] = []

  for (let i = 0; i < drivers.length; i++) {
    const d = drivers[i]
    try {
      // Check duplicate
      const existing = await prisma.driver.findUnique({
        where: { national_id: d.national_id },
      })
      if (existing) {
        failed++
        errors.push({ row: i + 1, error: `เลขบัตร ${d.national_id} มีในระบบแล้ว` })
        continue
      }

      await prisma.driver.create({
        data: {
          case_id: d.case_id || null,
          full_name: d.full_name,
          national_id: d.national_id,
          date_of_birth: new Date(d.date_of_birth),
          phone: d.phone || null,
          car_model: d.car_model || null,
        },
      })
      success++
    } catch (err: any) {
      failed++
      errors.push({ row: i + 1, error: err.message || 'Unknown error' })
    }
  }

  return NextResponse.json({ success, failed, errors })
}
