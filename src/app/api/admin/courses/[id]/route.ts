import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
  const { title, description, pass_score, is_active } = body

  const course = await prisma.course.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(pass_score !== undefined && { pass_score }),
      ...(is_active !== undefined && { is_active }),
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
