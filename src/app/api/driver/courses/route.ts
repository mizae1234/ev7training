import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const driverId = session.user.id

  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: { car_model: true }
  })

  const courses = await prisma.course.findMany({
    where: { 
      is_active: true,
      OR: [
        { target_car_model: null },
        ...(driver?.car_model ? [{ target_car_model: driver.car_model }] : [])
      ]
    },
    orderBy: { order_num: 'asc' },
    include: {
      steps: {
        orderBy: { order_num: 'asc' },
        select: {
          id: true,
          title: true,
          step_type: true,
          order_num: true,
          is_required: true,
        },
      },
    },
  })

  // Get driver's progress for all steps
  const stepIds = courses.flatMap(c => c.steps.map(s => s.id))
  const progresses = await prisma.courseStepProgress.findMany({
    where: {
      driver_id: driverId,
      step_id: { in: stepIds },
    },
  })

  const progressMap = new Map(progresses.map(p => [p.step_id, p]))

  const coursesWithProgress = courses.map(course => {
    const stepsWithProgress = course.steps.map(step => ({
      ...step,
      completed: progressMap.get(step.id)?.completed || false,
      score: progressMap.get(step.id)?.score || null,
    }))

    const requiredSteps = stepsWithProgress.filter(s => s.is_required)
    const completedRequired = requiredSteps.filter(s => s.completed).length
    const totalRequired = requiredSteps.length
    const courseCompleted = totalRequired > 0 && completedRequired >= totalRequired

    return {
      ...course,
      steps: stepsWithProgress,
      completedSteps: completedRequired,
      totalSteps: totalRequired,
      courseCompleted,
    }
  })

  return NextResponse.json({ courses: coursesWithProgress })
}
