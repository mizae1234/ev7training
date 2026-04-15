import { NextRequest, NextResponse } from 'next/server'
import { uploadLargeToS3 } from '@/lib/s3'

// Remove Next.js body size limit for this route
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const courseId = formData.get('courseId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'รองรับเฉพาะไฟล์วิดีโอ (MP4, WebM, MOV, AVI)' },
        { status: 400 }
      )
    }

    // Max 500MB
    const MAX_SIZE = 500 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'ไฟล์วิดีโอต้องไม่เกิน 500MB' },
        { status: 400 }
      )
    }

    // Generate unique filename with courseId subfolder
    const ext = file.name.split('.').pop() || 'mp4'
    const timestamp = Date.now()
    const safeName = file.name
      .replace(/\.[^/.]+$/, '') // remove extension
      .replace(/[^a-zA-Z0-9ก-๙_-]/g, '_') // sanitize
      .slice(0, 50)

    // Use courseId as subfolder if provided, otherwise fall back to generic video folder
    const folder = courseId
      ? `ev7training/courses/${courseId}`
      : `ev7training/video`
    const key = `${folder}/${timestamp}_${safeName}.${ext}`

    // Read file into buffer and use multipart upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log(`[UPLOAD] Starting upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB) -> ${key}`)

    const url = await uploadLargeToS3(key, buffer, file.type)

    console.log(`[UPLOAD] Complete: ${url}`)

    return NextResponse.json({
      url,
      key,
      filename: file.name,
      size: file.size,
    })
  } catch (error) {
    console.error('[UPLOAD] Error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปโหลด' },
      { status: 500 }
    )
  }
}
