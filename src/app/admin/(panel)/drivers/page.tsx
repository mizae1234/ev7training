'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Search, Plus, Upload, Filter, ChevronRight, Users } from 'lucide-react'

interface Driver {
  id: string
  case_id: string | null
  full_name: string
  national_id: string
  phone: string | null
  car_model: string | null
  project_type: string | null
  status: string
  onboarding_status: string
  created_at: string
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ full_name: '', national_id: '', date_of_birth: '', phone: '', project_type: '', case_id: '', car_model: '' })
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const fetchDrivers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filter !== 'all') params.set('status', filter)
      const res = await fetch(`/api/admin/drivers?${params}`)
      const data = await res.json()
      setDrivers(data.drivers || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, filter])

  useEffect(() => {
    const timer = setTimeout(fetchDrivers, 300)
    return () => clearTimeout(timer)
  }, [fetchDrivers])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    setAddLoading(true)
    try {
      const res = await fetch('/api/admin/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      if (!res.ok) {
        const data = await res.json()
        setAddError(data.error || 'เกิดข้อผิดพลาด')
      } else {
        setShowAddModal(false)
        setAddForm({ full_name: '', national_id: '', date_of_birth: '', phone: '', project_type: '', case_id: '', car_model: '' })
        fetchDrivers()
      }
    } catch {
      setAddError('เกิดข้อผิดพลาด')
    } finally {
      setAddLoading(false)
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'NOT_STARTED': return <span className="badge badge-gray">ยังไม่เริ่ม</span>
      case 'WATCHING': return <span className="badge badge-warning">กำลังดู</span>
      case 'PASSED': return <span className="badge badge-success">ผ่านแล้ว</span>
      default: return <span className="badge badge-gray">{status}</span>
    }
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการคนขับ</h1>
          <p className="text-gray-500 text-sm">จัดการข้อมูลคนขับทั้งหมด</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/drivers/import" className="btn-secondary text-sm py-2 px-4">
            <Upload className="w-4 h-4" />
            นำเข้า Excel
          </Link>
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm py-2 px-4">
            <Plus className="w-4 h-4" />
            เพิ่มคนขับ
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อหรือเลขบัตรประชาชน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'NOT_STARTED', 'WATCHING', 'PASSED'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-ev7-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'ทั้งหมด' 
                : f === 'NOT_STARTED' ? 'ยังไม่เริ่ม' 
                : f === 'WATCHING' ? 'กำลังดู' 
                : 'ผ่านแล้ว'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-ev7-500 border-t-transparent rounded-full" />
        </div>
      ) : drivers.length === 0 ? (
        <div className="text-center py-12 stat-card">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">ไม่พบข้อมูลคนขับ</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Case ID</th>
                <th>ชื่อ-นามสกุล</th>
                <th className="hidden sm:table-cell">เลขบัตรประชาชน</th>
                <th className="hidden md:table-cell">เบอร์โทร</th>
                <th>รุ่นรถ</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-sm font-semibold text-ev7-600">{d.case_id || '-'}</td>
                  <td className="font-medium">{d.full_name}</td>
                  <td className="hidden sm:table-cell font-mono text-sm">{d.national_id}</td>
                  <td className="hidden md:table-cell text-sm">{d.phone || '-'}</td>
                  <td>
                    {d.car_model ? (
                      <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded text-xs font-semibold">{d.car_model}</span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td>{statusBadge(d.onboarding_status)}</td>
                  <td>
                    <Link
                      href={`/admin/drivers/${d.id}`}
                      className="text-ev7-600 hover:text-ev7-800 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* Add Driver Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-6">เพิ่มคนขับ</h2>
            {addError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">
                {addError}
              </div>
            )}
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Case ID</label>
                  <input
                    type="text"
                    value={addForm.case_id}
                    onChange={(e) => setAddForm({ ...addForm, case_id: e.target.value })}
                    className="input-field font-mono"
                    placeholder="เลข Case ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ชื่อ-นามสกุล *</label>
                  <input
                    type="text"
                    value={addForm.full_name}
                    onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">เลขบัตรประชาชน *</label>
                <input
                  type="text"
                  maxLength={13}
                  value={addForm.national_id}
                  onChange={(e) => setAddForm({ ...addForm, national_id: e.target.value.replace(/\D/g, '') })}
                  className="input-field font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">วันเกิด *</label>
                <input
                  type="date"
                  value={addForm.date_of_birth}
                  onChange={(e) => setAddForm({ ...addForm, date_of_birth: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">เบอร์โทร</label>
                <input
                  type="text"
                  maxLength={10}
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value.replace(/\D/g, '') })}
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">รุ่นรถ</label>
                  <input
                    type="text"
                    value={addForm.car_model}
                    onChange={(e) => setAddForm({ ...addForm, car_model: e.target.value })}
                    className="input-field"
                    placeholder="เช่น AION Y PLUS"
                    list="car-models-add"
                  />
                  <datalist id="car-models-add">
                    {Array.from(new Set(drivers.map(d => d.car_model).filter(Boolean))).map(model => (
                      <option key={model} value={model!} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ประเภทโครงการ</label>
                  <input
                    type="text"
                    value={addForm.project_type}
                    onChange={(e) => setAddForm({ ...addForm, project_type: e.target.value })}
                    className="input-field"
                    placeholder="เช่น EV7, GRAB"
                    list="project-types"
                  />
                  <datalist id="project-types">
                    <option value="EV7" />
                    <option value="GRAB" />
                    <option value="Lineman" />
                  </datalist>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1 py-3">
                  ยกเลิก
                </button>
                <button type="submit" disabled={addLoading} className="btn-primary flex-1 py-3">
                  {addLoading ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
