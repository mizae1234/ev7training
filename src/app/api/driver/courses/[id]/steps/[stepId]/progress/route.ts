import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateCertificateNo } from '@/lib/utils'

// POST = save video progress, PUT = submit quiz
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: courseId, stepId } = await params
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

  if (completed) {
    await checkCourseCompletion(courseId, driverId, 100)
  }

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

  const { id: courseId, stepId } = await params
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
  
  // get course to find its pass_score
  const course = await prisma.course.findUnique({ where: { id: courseId } })
  const coursePassScore = course?.pass_score || 80
  const passed = score >= coursePassScore

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

  if (passed) {
    await checkCourseCompletion(courseId, driverId, score)
  }

  return NextResponse.json({
    score,
    passed,
    answers: detailedAnswers,
    total: questions.length,
    correct,
  })
}

// Check and generate certificate if all required steps are completed
async function checkCourseCompletion(courseId: string, driverId: string, finalScore: number) {
  // Get all required steps for the course
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { steps: { where: { is_required: true } } }
  })
  
  if (!course || course.steps.length === 0) return false

  // Get driver's completed steps
  const progressList = await prisma.courseStepProgress.findMany({
    where: { 
      driver_id: driverId, 
      step_id: { in: course.steps.map(s => s.id) }, 
      completed: true 
    }
  })

  // Has completed all required steps?
  if (progressList.length >= course.steps.length) {
    // 1. Mark course attempt as passed
    const existingAttempt = await prisma.courseAttempt.findFirst({
      where: { driver_id: driverId, course_id: courseId }
    })
    
    if (existingAttempt) {
      await prisma.courseAttempt.update({
        where: { id: existingAttempt.id },
        data: { passed: true, score: finalScore, completed_at: new Date() }
      })
    } else {
      await prisma.courseAttempt.create({
        data: {
          driver_id: driverId,
          course_id: courseId,
          passed: true,
          score: finalScore,
          completed_at: new Date(),
        }
      })
    }
    
    // 2. Generate certificate if not exists
    const existingCert = await prisma.certificate.findFirst({
      where: { driver_id: driverId }
    })
    
    if (!existingCert) {
      const certNo = generateCertificateNo()
      await prisma.certificate.create({
        data: {
          certificate_no: certNo,
          driver_id: driverId,
          score: finalScore,
        }
      })
      
      // Update driver status
      await prisma.driver.update({
        where: { id: driverId },
        data: { onboarding_status: 'PASSED' }
      })
    }
    
    return true
  }
  return false
}
