import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const models = await prisma.driver.findMany({
      where: { car_model: { not: null } },
      select: { car_model: true },
      distinct: ['car_model'],
    })
    const uniqueModels = models.map(m => m.car_model).filter(Boolean)
    return NextResponse.json({ models: uniqueModels })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
