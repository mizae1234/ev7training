import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    // Delete driver records safely. Prisma might cascade if defined, but doing it manually is safer if no cascade.
    await prisma.$transaction([
      prisma.videoProgress.deleteMany({ where: { driver_id: id } }),
      prisma.quizAttempt.deleteMany({ where: { driver_id: id } }),
      prisma.certificate.deleteMany({ where: { driver_id: id } }),
      prisma.courseStepProgress.deleteMany({ where: { driver_id: id } }),
      prisma.courseAttempt.deleteMany({ where: { driver_id: id } }),
      prisma.driver.delete({ where: { id } })
    ])

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete driver error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  try {
    const dataToUpdate: any = {
      full_name: body.full_name,
      national_id: body.national_id,
      date_of_birth: body.date_of_birth ? new Date(body.date_of_birth) : undefined,
      phone: body.phone || null,
      case_id: body.case_id || null,
      car_model: body.car_model || null,
      project_type: body.project_type || null,
      status: body.status,
    }

    if (body.national_id) {
      // Check for duplicate national id
      const existing = await prisma.driver.findUnique({ where: { national_id: body.national_id } })
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: 'เลขบัตรประชาชนนี้มีในระบบแล้ว' }, { status: 400 })
      }
    }

    const updated = await prisma.driver.update({
      where: { id },
      data: dataToUpdate,
    })

    return NextResponse.json(updated)
  } catch (err: any) {
    console.error('Update driver error:', err)
    return NextResponse.json({ error: err.message || 'Error updating driver' }, { status: 500 })
  }
}
