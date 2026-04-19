import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const courses = await prisma.course.findMany({
    orderBy: { order_num: 'asc' },
    include: {
      steps: {
        orderBy: { order_num: 'asc' },
        select: { id: true, title: true, step_type: true, order_num: true },
      },
      _count: {
        select: { attempts: true },
      },
    },
  })

  return NextResponse.json({ courses })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { title, description, pass_score, target_car_model } = body

  if (!title) {
    return NextResponse.json({ error: 'กรุณาระบุชื่อหลักสูตร' }, { status: 400 })
  }

  const maxOrder = await prisma.course.aggregate({ _max: { order_num: true } })

  const course = await prisma.course.create({
    data: {
      title,
      description: description || null,
      pass_score: pass_score ?? 80,
      target_car_model: target_car_model || null,
      order_num: (maxOrder._max.order_num || 0) + 1,
    },
  })

  return NextResponse.json(course, { status: 201 })
}
