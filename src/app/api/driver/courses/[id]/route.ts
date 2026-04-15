import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const driverId = session.user.id

  const course = await prisma.course.findUnique({
    where: { id, is_active: true },
    include: {
      steps: {
        orderBy: { order_num: 'asc' },
      },
    },
  })

  if (!course) {
    return NextResponse.json({ error: 'ไม่พบหลักสูตร' }, { status: 404 })
  }

  // Get progress for all steps
  const progresses = await prisma.courseStepProgress.findMany({
    where: {
      driver_id: driverId,
      step_id: { in: course.steps.map(s => s.id) },
    },
  })

  const progressMap = new Map(progresses.map(p => [p.step_id, p]))

  const stepsWithProgress = course.steps.map((step, idx) => {
    const prog = progressMap.get(step.id)
    // A step is unlocked if it's the first or the previous required step is completed
    const prevSteps = course.steps.slice(0, idx)
    const prevRequiredCompleted = prevSteps
      .filter(s => s.is_required)
      .every(s => progressMap.get(s.id)?.completed)
    const unlocked = idx === 0 || prevRequiredCompleted

    return {
      ...step,
      completed: prog?.completed || false,
      score: prog?.score || null,
      max_watched_time: prog?.max_watched_time || null,
      total_duration: prog?.total_duration || null,
      unlocked,
    }
  })

  return NextResponse.json({
    ...course,
    steps: stepsWithProgress,
  })
}
