'use client'

import { useState, useEffect } from 'react'
import { Award, Search, XCircle, AlertCircle, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { formatDate, maskNationalId } from '@/lib/utils'
import { useModal } from '@/components/ui/ModalProvider'

interface Certificate {
  id: string
  certificate_no: string
  score: number
  issued_at: string
  status: string
  revoked_at: string | null
  revoked_reason: string | null
  driver: {
    full_name: string
    national_id: string
    case_id: string | null
    car_model: string | null
  }
}

export default function CertificatesPage() {
  const modal = useModal()
  const [certs, setCerts] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    fetchCerts()
  }, [])

  const fetchCerts = async () => {
    try {
      const res = await fetch('/api/admin/certificates')
      const data = await res.json()
      setCerts(data.certificates || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (id: string) => {
    const isConfirm = await modal.confirm('ต้องการเพิกถอน Certificate นี้?', 'เพิกถอน Certificate')
    if (!isConfirm) return
    setRevoking(id)
    try {
      await fetch('/api/admin/certificates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'revoke' }),
      })
      fetchCerts()
    } finally {
      setRevoking(null)
    }
  }

  const filtered = certs.filter(c =>
    c.certificate_no.toLowerCase().includes(search.toLowerCase()) ||
    c.driver.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.driver.national_id.includes(search) ||
    (c.driver.case_id && c.driver.case_id.toLowerCase().includes(search.toLowerCase()))
  )

  const handleExport = () => {
    const data = filtered.map(c => ({
      'Case ID': c.driver.case_id || '-',
      'ชื่อ-นามสกุล': c.driver.full_name,
      'เลขบัตรประชาชน': c.driver.national_id,
      'รุ่นรถ': c.driver.car_model || '-',
      'เลข Certificate': c.certificate_no,
      'คะแนน': Math.round(c.score) + '%',
      'วันที่ออก': formatDate(c.issued_at),
      'สถานะ': c.status === 'VALID' ? 'ใช้งานได้' : 'เพิกถอน'
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Certificates')
    XLSX.writeFile(wb, `Certificates_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-ev7-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">จัดการ Certificate</h1>
        <p className="text-gray-500 text-sm">ใบรับรองทั้งหมด {certs.length} ใบ</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาเลข Certificate, ชื่อ, เลขบัตร, Case ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <button onClick={handleExport} className="btn-secondary whitespace-nowrap hidden sm:flex">
          <Download className="w-4 h-4 mr-2" />
          Export Excel
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 stat-card">
          <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">ไม่พบ Certificate</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>เลข Certificate</th>
                <th>Case ID</th>
                <th>ชื่อ</th>
                <th className="hidden sm:table-cell">เลขบัตรฯ</th>
                <th className="hidden md:table-cell">รุ่นรถ</th>
                <th className="hidden sm:table-cell">คะแนน</th>
                <th className="hidden md:table-cell">วันที่ออก</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-sm font-semibold">{c.certificate_no}</td>
                  <td className="font-mono text-sm font-semibold text-ev7-600">{c.driver.case_id || '-'}</td>
                  <td className="font-medium">{c.driver.full_name}</td>
                  <td className="hidden sm:table-cell font-mono text-sm text-gray-500">{maskNationalId(c.driver.national_id)}</td>
                  <td className="hidden md:table-cell text-sm truncate max-w-[120px]">{c.driver.car_model || '-'}</td>
                  <td className="hidden sm:table-cell">{Math.round(c.score)}%</td>
                  <td className="hidden md:table-cell text-sm">{formatDate(c.issued_at)}</td>
                  <td>
                    <span className={`badge ${c.status === 'VALID' ? 'badge-success' : 'badge-danger'}`}>
                      {c.status === 'VALID' ? 'ใช้งานได้' : 'เพิกถอน'}
                    </span>
                  </td>
                  <td>
                    {c.status === 'VALID' && (
                      <button
                        onClick={() => handleRevoke(c.id)}
                        disabled={revoking === c.id}
                        className="text-red-500 hover:text-red-700 transition-colors p-1"
                        title="เพิกถอน"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
