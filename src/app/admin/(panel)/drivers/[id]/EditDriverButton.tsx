'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Edit2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DriverData {
  id: string
  case_id: string | null
  full_name: string
  national_id: string
  date_of_birth: Date
  phone: string | null
  car_model: string | null
  project_type: string | null
  status: string
  onboarding_status: string
}

export default function EditDriverButton({ driver, carModels }: { driver: DriverData, carModels: string[] }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Format date for input type="date"
  const formattedDob = driver.date_of_birth
    ? new Date(driver.date_of_birth).toISOString().split('T')[0]
    : ''

  const [form, setForm] = useState({
    case_id: driver.case_id || '',
    full_name: driver.full_name || '',
    national_id: driver.national_id || '',
    date_of_birth: formattedDob,
    phone: driver.phone || '',
    car_model: driver.car_model || '',
    project_type: driver.project_type || '',
    status: driver.status,
    onboarding_status: driver.onboarding_status,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/drivers/${driver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล')
      } else {
        setShowModal(false)
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="btn-secondary py-2 px-3 text-sm flex items-center gap-2"
      >
        <Edit2 className="w-4 h-4" />
        แก้ไขข้อมูล
      </button>

      {showModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-6">แก้ไขข้อมูลคนขับ</h2>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Case ID</label>
                  <input
                    type="text"
                    value={form.case_id}
                    onChange={(e) => setForm({ ...form, case_id: e.target.value })}
                    className="input-field font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ชื่อ-นามสกุล *</label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">เลขบัตรประชาชน *</label>
                  <input
                    type="text"
                    maxLength={13}
                    value={form.national_id}
                    onChange={(e) => setForm({ ...form, national_id: e.target.value.replace(/\D/g, '') })}
                    className="input-field font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">วันเกิด *</label>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">เบอร์โทร</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">รุ่นรถ</label>
                  <input
                    type="text"
                    value={form.car_model}
                    onChange={(e) => setForm({ ...form, car_model: e.target.value })}
                    className="input-field"
                    list="car-models-edit"
                  />
                  <datalist id="car-models-edit">
                    {carModels.map(model => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ประเภทโครงการ</label>
                  <input
                    type="text"
                    value={form.project_type}
                    onChange={(e) => setForm({ ...form, project_type: e.target.value })}
                    className="input-field"
                    list="project-types-edit"
                  />
                  <datalist id="project-types-edit">
                    <option value="EV7" />
                    <option value="GRAB" />
                    <option value="Lineman" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">สถานะ</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="input-field"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-3">
                  ยกเลิก
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">
                  {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
