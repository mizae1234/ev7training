'use client'

import { useState, useEffect } from 'react'
import { Plus, BookOpen, ChevronRight, PlayCircle, ClipboardCheck, ToggleLeft, ToggleRight, Loader2, MoreVertical } from 'lucide-react'
import KebabMenu from './KebabMenu'

interface CourseItem {
  id: string
  title: string
  description: string | null
  target_car_model: string | null
  pass_score: number
  is_active: boolean
  order_num: number
  steps: { id: string; title: string; step_type: string; order_num: number }[]
  _count: { attempts: number }
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', pass_score: 80, target_car_model: '' })
  const [creating, setCreating] = useState(false)
  const [carModels, setCarModels] = useState<string[]>([])

  useEffect(() => {
    fetchCourses()
    fetchCarModels()
  }, [])

  const fetchCarModels = async () => {
    try {
      const res = await fetch('/api/admin/drivers/car-models')
      const data = await res.json()
      setCarModels(data.models || [])
    } catch(err) {
      console.error(err)
    }
  }

  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/admin/courses')
      const data = await res.json()
      setCourses(data.courses || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!form.title) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowCreate(false)
        setForm({ title: '', description: '', pass_score: 80, target_car_model: '' })
        fetchCourses()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (course: CourseItem) => {
    await fetch(`/api/admin/courses/${course.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !course.is_active }),
    })
    fetchCourses()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-ev7-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการหลักสูตร</h1>
          <p className="text-gray-500 text-sm">{courses.length} หลักสูตร</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary text-sm py-2 px-4"
        >
          <Plus className="w-4 h-4" />
          สร้างหลักสูตร
        </button>
      </div>

      {/* Course Cards */}
      {courses.length === 0 ? (
        <div className="text-center py-16 stat-card">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">ยังไม่มีหลักสูตร</p>
          <p className="text-gray-400 text-sm mt-1">กดปุ่ม &quot;สร้างหลักสูตร&quot; เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {courses.map((course) => {
            const videoSteps = course.steps.filter(s => s.step_type === 'VIDEO')
            const quizSteps = course.steps.filter(s => s.step_type === 'QUIZ')
            return (
              <div
                key={course.id}
                className={`stat-card p-5 transition-all ${!course.is_active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-gray-900 text-lg truncate">{course.title}</h3>
                      {course.is_active ? (
                        <span className="badge badge-success">เปิดใช้</span>
                      ) : (
                        <span className="badge badge-gray">ปิดอยู่</span>
                      )}
                    </div>
                    {course.description && (
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{course.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <PlayCircle className="w-3.5 h-3.5" />
                        {videoSteps.length} วิดีโอ
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        {quizSteps.length} แบบทดสอบ
                      </span>
                      <span>
                        {course.pass_score === 0 ? 'ไม่ต้องสอบ' : `คะแนนผ่าน ${course.pass_score}%`}
                      </span>
                      {course.target_car_model && (
                        <span className="bg-ev7-50 text-ev7-600 px-2 rounded-full font-medium">เฉพาะรุ่น: {course.target_car_model}</span>
                      )}
                      <span>{course._count.attempts} ผู้เข้าเรียน</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggleActive(course)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      title={course.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    >
                      {course.is_active ? (
                        <ToggleRight className="w-5 h-5 text-ev7-500" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                    <KebabMenu courseId={course.id} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>

      {/* Create Course Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-6">สร้างหลักสูตรใหม่</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">ชื่อหลักสูตร *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input-field"
                  placeholder="เช่น อบรมพนักงานขับรถ EV7 รุ่นที่ 1"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">คำอธิบาย</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-field min-h-[80px]"
                  rows={3}
                  placeholder="รายละเอียดหลักสูตร (ไม่บังคับ)"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">รุ่นรถที่กำหนด</label>
                <input
                  type="text"
                  value={form.target_car_model}
                  onChange={(e) => setForm({ ...form, target_car_model: e.target.value })}
                  className="input-field"
                  placeholder="เช่น AION Y PLUS (เว้นว่างไว้หากให้เห็นทุกรุ่น)"
                  list="car-models-list"
                />
                <datalist id="car-models-list">
                  {carModels.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">คะแนนผ่าน (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.pass_score}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setForm({ ...form, pass_score: isNaN(val) ? 0 : val })
                  }}
                  className="input-field w-32"
                />
                <p className="text-xs text-gray-500 mt-2">ใส่ 0 หากเป็นคอร์สให้ความรู้ (Knowledge) ที่ไม่ต้องมีการสอบผ่าน</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1 py-3">ยกเลิก</button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !form.title}
                  className="btn-primary flex-1 py-3"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> กำลังสร้าง...</>
                  ) : (
                    'สร้างหลักสูตร'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
