import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: { order_num: 'asc' },
        include: {
          _count: { select: { progress: true } },
        },
      },
      attempts: {
        include: { driver: true },
        orderBy: { created_at: 'desc' },
      },
      _count: {
        select: { attempts: true },
      },
    },
  })

  if (!course) {
    return NextResponse.json({ error: 'ไม่พบหลักสูตร' }, { status: 404 })
  }

  return NextResponse.json(course)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { title, description, pass_score, is_active, target_car_model, is_mandatory } = body

  const course = await prisma.course.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(pass_score !== undefined && { pass_score }),
      ...(is_active !== undefined && { is_active }),
      ...(is_mandatory !== undefined && { is_mandatory }),
      ...(target_car_model !== undefined && { target_car_model: target_car_model || null }),
    },
  })

  return NextResponse.json(course)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  await prisma.course.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
