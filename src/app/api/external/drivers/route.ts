import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

  // --- Authenticate via API Key ---
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await logRequest({
      endpoint: '/api/external/drivers',
      requestBody: {},
      responseBody: { error: 'Missing Authorization header' },
      statusCode: 401,
      ip,
      apiKey: null,
      created: 0,
      failed: 0,
    })
    return NextResponse.json(
      { error: 'Missing Authorization header. Use: Authorization: Bearer <API_KEY>' },
      { status: 401 }
    )
  }

  const apiKey = authHeader.slice(7) // Remove "Bearer "
  if (apiKey !== process.env.EXTERNAL_API_KEY) {
    await logRequest({
      endpoint: '/api/external/drivers',
      requestBody: {},
      responseBody: { error: 'Invalid API Key' },
      statusCode: 401,
      ip,
      apiKey: maskKey(apiKey),
      created: 0,
      failed: 0,
    })
    return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 })
  }

  // --- Parse body ---
  let body: any
  try {
    body = await request.json()
  } catch {
    await logRequest({
      endpoint: '/api/external/drivers',
      requestBody: {},
      responseBody: { error: 'Invalid JSON body' },
      statusCode: 400,
      ip,
      apiKey: maskKey(apiKey),
      created: 0,
      failed: 0,
    })
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { drivers } = body

  if (!Array.isArray(drivers) || drivers.length === 0) {
    const resp = { error: 'Request body must contain a non-empty "drivers" array' }
    await logRequest({
      endpoint: '/api/external/drivers',
      requestBody: body,
      responseBody: resp,
      statusCode: 400,
      ip,
      apiKey: maskKey(apiKey),
      created: 0,
      failed: 0,
    })
    return NextResponse.json(resp, { status: 400 })
  }

  // --- Process each driver ---
  let created = 0
  let failed = 0
  const errors: { index: number; national_id?: string; error: string }[] = []

  for (let i = 0; i < drivers.length; i++) {
    const d = drivers[i]
    try {
      // Validate required fields
      if (!d.full_name || !d.national_id || !d.date_of_birth) {
        failed++
        errors.push({ index: i, national_id: d.national_id, error: 'Missing required fields: full_name, national_id, date_of_birth' })
        continue
      }

      // Validate national_id format (13 digits)
      const nationalId = String(d.national_id).replace(/\D/g, '')
      if (nationalId.length !== 13) {
        failed++
        errors.push({ index: i, national_id: d.national_id, error: 'national_id must be 13 digits' })
        continue
      }

      // Validate date_of_birth
      const dob = new Date(d.date_of_birth)
      if (isNaN(dob.getTime())) {
        failed++
        errors.push({ index: i, national_id: nationalId, error: 'Invalid date_of_birth format. Use YYYY-MM-DD' })
        continue
      }

      // Check duplicate — reject if exists
      const existing = await prisma.driver.findUnique({
        where: { national_id: nationalId },
      })
      if (existing) {
        failed++
        errors.push({ index: i, national_id: nationalId, error: `เลขบัตร ${nationalId} มีในระบบแล้ว` })
        continue
      }

      // Create new driver
      await prisma.driver.create({
        data: {
          case_id: d.case_id || null,
          full_name: d.full_name,
          national_id: nationalId,
          date_of_birth: dob,
          phone: d.phone || null,
          car_model: d.car_model || null,
          project_type: d.project_type || null,
        },
      })
      created++
    } catch (err: any) {
      failed++
      errors.push({ index: i, national_id: d.national_id, error: err.message || 'Unknown error' })
    }
  }

  const responseBody = {
    created,
    failed,
    errors,
    total_received: drivers.length,
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
  }

  const statusCode = failed > 0 && created > 0 ? 207 : failed > 0 && created === 0 ? 400 : 200

  // Log the request
  await logRequest({
    endpoint: '/api/external/drivers',
    requestBody: body,
    responseBody,
    statusCode,
    ip,
    apiKey: maskKey(apiKey),
    created,
    failed,
  })

  return NextResponse.json(responseBody, { status: statusCode })
}

// --- Helper: Log API request ---
interface LogParams {
  endpoint: string
  requestBody: any
  responseBody: any
  statusCode: number
  ip: string
  apiKey: string | null
  created: number
  failed: number
}

async function logRequest(params: LogParams) {
  try {
    await prisma.externalApiLog.create({
      data: {
        endpoint: params.endpoint,
        method: 'POST',
        request_body: params.requestBody,
        response_body: params.responseBody,
        status_code: params.statusCode,
        ip_address: params.ip,
        api_key_used: params.apiKey,
        created_count: params.created,
        failed_count: params.failed,
      },
    })
  } catch (err) {
    console.error('[ExternalAPI] Failed to write log:', err)
  }
}

// --- Helper: Mask API key for logging (show first 8 chars) ---
function maskKey(key: string): string {
  if (key.length <= 8) return '***'
  return key.slice(0, 8) + '***'
}
