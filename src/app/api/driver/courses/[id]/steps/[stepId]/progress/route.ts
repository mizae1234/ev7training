import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST = save video progress, PUT = submit quiz
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { stepId } = await params
  const driverId = session.user.id
  const body = await request.json()
  const { max_watched_time, total_duration, completed } = body

  const step = await prisma.courseStep.findUnique({ where: { id: stepId } })
  if (!step || step.step_type !== 'VIDEO') {
    return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
  }

  const progress = await prisma.courseStepProgress.upsert({
    where: {
      driver_id_step_id: { driver_id: driverId, step_id: stepId },
    },
    create: {
      driver_id: driverId,
      step_id: stepId,
      max_watched_time: max_watched_time || 0,
      total_duration: total_duration || 0,
      completed: completed || false,
    },
    update: {
      max_watched_time: max_watched_time || undefined,
      total_duration: total_duration || undefined,
      completed: completed || undefined,
    },
  })

  return NextResponse.json(progress)
}

// PUT = submit quiz answers
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { stepId } = await params
  const driverId = session.user.id
  const body = await request.json()
  const { answers } = body // { questionId: selectedIndex }

  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'Invalid answers' }, { status: 400 })
  }

  const step = await prisma.courseStep.findUnique({ where: { id: stepId } })
  if (!step || step.step_type !== 'QUIZ') {
    return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
  }

  // Get the questions for this step from master
  const questionIds = Object.keys(answers)
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
  })

  let correct = 0
  const detailedAnswers = questions.map(q => {
    const selected = answers[q.id]
    const isCorrect = selected === q.correct_answer
    if (isCorrect) correct++
    return {
      question_id: q.id,
      selected,
      correct: q.correct_answer,
      is_correct: isCorrect,
    }
  })

  const score = questions.length > 0 ? (correct / questions.length) * 100 : 0
  const passed = score >= 80 // default pass score

  // Save progress
  await prisma.courseStepProgress.upsert({
    where: {
      driver_id_step_id: { driver_id: driverId, step_id: stepId },
    },
    create: {
      driver_id: driverId,
      step_id: stepId,
      completed: passed,
      score,
    },
    update: {
      completed: passed,
      score,
    },
  })

  return NextResponse.json({
    score,
    passed,
    answers: detailedAnswers,
    total: questions.length,
    correct,
  })
}
