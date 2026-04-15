import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const { stepId } = await params
  const body = await request.json()
  const {
    title,
    video_url,
    video_required_percentage,
    num_questions,
    question_ids,
    is_required,
  } = body

  const step = await prisma.courseStep.update({
    where: { id: stepId },
    data: {
      ...(title !== undefined && { title }),
      ...(video_url !== undefined && { video_url }),
      ...(video_required_percentage !== undefined && { video_required_percentage }),
      ...(num_questions !== undefined && { num_questions }),
      ...(question_ids !== undefined && { question_ids }),
      ...(is_required !== undefined && { is_required }),
    },
  })

  return NextResponse.json(step)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const { stepId } = await params

  await prisma.courseStep.delete({ where: { id: stepId } })
  return NextResponse.json({ success: true })
}
