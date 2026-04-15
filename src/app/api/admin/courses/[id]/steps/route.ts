import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params
  const body = await request.json()
  const {
    title,
    step_type,
    video_url,
    video_required_percentage,
    num_questions,
    question_ids,
    is_required,
  } = body

  if (!title || !step_type) {
    return NextResponse.json({ error: 'กรุณาระบุชื่อขั้นตอนและประเภท' }, { status: 400 })
  }

  if (!['VIDEO', 'QUIZ'].includes(step_type)) {
    return NextResponse.json({ error: 'ประเภทไม่ถูกต้อง' }, { status: 400 })
  }

  const maxOrder = await prisma.courseStep.aggregate({
    _max: { order_num: true },
    where: { course_id: courseId },
  })

  const step = await prisma.courseStep.create({
    data: {
      course_id: courseId,
      title,
      step_type,
      order_num: (maxOrder._max.order_num || 0) + 1,
      is_required: is_required !== false,
      video_url: step_type === 'VIDEO' ? video_url || null : null,
      video_required_percentage:
        step_type === 'VIDEO' ? video_required_percentage || 95 : null,
      num_questions: step_type === 'QUIZ' ? num_questions || 10 : null,
      question_ids: step_type === 'QUIZ' ? question_ids || [] : null,
    },
  })

  return NextResponse.json(step, { status: 201 })
}

// Reorder steps
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params
  const body = await request.json()
  const { stepOrders } = body // [{ id, order_num }]

  if (!Array.isArray(stepOrders)) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  await prisma.$transaction(
    stepOrders.map((s: { id: string; order_num: number }) =>
      prisma.courseStep.update({
        where: { id: s.id, course_id: courseId },
        data: { order_num: s.order_num },
      })
    )
  )

  return NextResponse.json({ success: true })
}
