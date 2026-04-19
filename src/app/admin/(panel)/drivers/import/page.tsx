'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Upload, FileSpreadsheet, ArrowLeft, CheckCircle2, XCircle, Loader2, AlertCircle, Download, Filter } from 'lucide-react'
import * as XLSX from 'xlsx'

interface PreviewRow {
  case_id: string
  full_name: string
  national_id: string
  date_of_birth: string
  phone: string
  car_model: string
  valid: boolean
  error?: string
}

interface ImportResult {
  success: number
  failed: number
  errors: { row: number; error: string }[]
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [skippedCount, setSkippedCount] = useState(0)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setSkippedCount(0)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = evt.target?.result
      const wb = XLSX.read(data, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

      let skipped = 0
      const rows: PreviewRow[] = []

      for (const row of json) {
        // Filter: only rows where วันที่ CA Approve is not empty
        const caApprove = String(row['วันที่ CA Approve'] || '').trim()
        if (!caApprove) {
          skipped++
          continue
        }

        const case_id = String(row['Case ID'] || '').trim()
        const full_name = String(row['ชื่อ (ผู้สมัคร)'] || '').trim()
        const national_id = String(row['หมายเลขบัตรประชาชน (ผู้สมัคร)'] || '').replace(/\D/g, '').trim()
        const dob = row['วันเดือนปีเกิด (พ.ศ.)'] || ''
        const phone = String(row['เบอร์โทรศัพท์ (OTP)'] || '').replace(/\D/g, '').trim()
        const car_model = String(row['รุ่นรถ'] || '').trim()

        // Parse date (supports Buddhist Era)
        let date_of_birth = ''
        if (typeof dob === 'number') {
          // Excel serial date
          const d = XLSX.SSF.parse_date_code(dob)
          const ceYear = d.y > 2400 ? d.y - 543 : d.y
          date_of_birth = `${ceYear}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
        } else {
          const dobStr = String(dob).trim()
          if (dobStr.includes('/')) {
            const parts = dobStr.split('/')
            if (parts.length === 3) {
              const d = parts[0].padStart(2, '0')
              const m = parts[1].padStart(2, '0')
              let y = parseInt(parts[2], 10)
              if (y > 2400) y -= 543
              date_of_birth = `${y}-${m}-${d}`
            }
          } else if (dobStr.includes('-')) {
            const parts = dobStr.split('-')
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                let y = parseInt(parts[0], 10)
                if (y > 2400) y -= 543
                date_of_birth = `${y}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
              } else {
                const d = parts[0].padStart(2, '0')
                const m = parts[1].padStart(2, '0')
                let y = parseInt(parts[2], 10)
                if (y > 2400) y -= 543
                date_of_birth = `${y}-${m}-${d}`
              }
            }
          } else {
            date_of_birth = dobStr
          }
        }

        let valid = true
        let error = ''

        if (!full_name) { valid = false; error = 'ไม่มีชื่อ' }
        else if (national_id.length !== 13) { valid = false; error = 'เลขบัตรไม่ครบ 13 หลัก' }
        else if (!date_of_birth || isNaN(Date.parse(date_of_birth))) { valid = false; error = 'วันเกิดไม่ถูกต้อง' }

        rows.push({ case_id, full_name, national_id, date_of_birth, phone, car_model, valid, error })
      }

      setSkippedCount(skipped)
      setPreview(rows)
    }
    reader.readAsBinaryString(file)
  }

  const handleImport = async () => {
    const validRows = preview.filter(r => r.valid)
    if (validRows.length === 0) return

    setImporting(true)
    try {
      const res = await fetch('/api/admin/drivers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drivers: validRows }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      console.error(err)
    } finally {
      setImporting(false)
    }
  }

  const validCount = preview.filter(r => r.valid).length
  const invalidCount = preview.filter(r => !r.valid).length

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <Link href="/admin/drivers" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
        <ArrowLeft className="w-4 h-4" />
        กลับหน้ารายชื่อ
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">นำเข้าจาก Excel</h1>
          <p className="text-gray-500 text-sm">อัปโหลดไฟล์ .xlsx จากระบบ CA — กรองเฉพาะแถวที่ CA Approve แล้ว</p>
        </div>
        <a
          href="/format_excel.xlsx"
          download
          className="btn-secondary py-2 text-sm whitespace-nowrap inline-flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          ดาวน์โหลด Format ตัวอย่าง
        </a>
      </div>

      {/* Upload Area */}
      {!result && (
        <div
          className="stat-card p-12 text-center border-2 border-dashed border-gray-300 hover:border-ev7-400 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
          <FileSpreadsheet className="w-16 h-16 text-ev7-300 mx-auto mb-4" />
          <p className="text-gray-600 font-semibold mb-1">
            {fileName ? fileName : 'คลิกหรือลากไฟล์ Excel มาวาง'}
          </p>
          <p className="text-gray-400 text-sm">รองรับ .xlsx, .xls — ใช้ format จากระบบ CA</p>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && !result && (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-gray-600">แถวที่ CA Approve แล้ว: {preview.length} แถว</span>
            <span className="badge badge-success">{validCount} ถูกต้อง</span>
            {invalidCount > 0 && <span className="badge badge-danger">{invalidCount} มีปัญหา</span>}
            {skippedCount > 0 && (
              <span className="flex items-center gap-1 text-sm text-gray-400">
                <Filter className="w-3.5 h-3.5" />
                ข้าม {skippedCount} แถว (ยังไม่ CA Approve)
              </span>
            )}
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Case ID</th>
                  <th>ชื่อ</th>
                  <th>เลขบัตร</th>
                  <th>วันเกิด</th>
                  <th>เบอร์โทร</th>
                  <th>รุ่นรถ</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 100).map((row, i) => (
                  <tr key={i} className={!row.valid ? 'bg-red-50' : ''}>
                    <td className="text-sm text-gray-400">{i + 1}</td>
                    <td className="font-mono text-sm font-semibold text-ev7-600">{row.case_id || '-'}</td>
                    <td className="font-medium">{row.full_name || '-'}</td>
                    <td className="font-mono text-sm">{row.national_id || '-'}</td>
                    <td className="text-sm">{row.date_of_birth || '-'}</td>
                    <td className="text-sm">{row.phone || '-'}</td>
                    <td>
                      {row.car_model ? (
                        <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded text-xs font-semibold">{row.car_model}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td>
                      {row.valid ? (
                        <CheckCircle2 className="w-5 h-5 text-ev7-500" />
                      ) : (
                        <div className="flex items-center gap-1">
                          <XCircle className="w-5 h-5 text-red-500" />
                          <span className="text-xs text-red-600">{row.error}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={importing || validCount === 0}
            className="btn-primary w-full py-4 text-lg rounded-2xl"
          >
            {importing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                กำลังนำเข้า...
              </>
            ) : (
              `นำเข้า ${validCount} รายการ`
            )}
          </button>
        </>
      )}

      {/* Result */}
      {result && (
        <div className="stat-card p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-ev7-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">นำเข้าเสร็จสิ้น!</h2>
          <div className="flex justify-center gap-6 mb-6">
            <div>
              <div className="text-3xl font-bold text-ev7-600">{result.success}</div>
              <div className="text-sm text-gray-500">สำเร็จ</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-500">{result.failed}</div>
              <div className="text-sm text-gray-500">ไม่สำเร็จ</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="text-left mt-4">
              <h3 className="font-semibold text-gray-700 mb-2">รายละเอียดข้อผิดพลาด:</h3>
              <div className="space-y-1">
                {result.errors.map((err, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-gray-600">แถว {err.row}: {err.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { setPreview([]); setResult(null); setFileName(''); setSkippedCount(0) }}
              className="btn-secondary flex-1 py-3"
            >
              นำเข้าอีกครั้ง
            </button>
            <Link href="/admin/drivers" className="btn-primary flex-1 py-3">
              ดูรายชื่อ
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
