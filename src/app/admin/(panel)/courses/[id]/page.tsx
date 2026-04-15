'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, PlayCircle, ClipboardCheck, Trash2, Pencil, Save,
  GripVertical, CheckCircle2, Loader2, ChevronDown, ChevronUp, Search,
  Upload, FileVideo,
} from 'lucide-react'

interface CourseStep {
  id: string
  title: string
  step_type: 'VIDEO' | 'QUIZ'
  order_num: number
  is_required: boolean
  video_url: string | null
  video_required_percentage: number | null
  num_questions: number | null
  question_ids: string[] | null
  _count: { progress: number }
}

interface CourseData {
  id: string
  title: string
  description: string | null
  pass_score: number
  is_active: boolean
  steps: CourseStep[]
  _count: { attempts: number }
}

interface MasterQuestion {
  id: string
  question_text: string
  options: string[]
  correct_answer: number
  is_active: boolean
  order_num: number
}

export default function CourseBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [course, setCourse] = useState<CourseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddStep, setShowAddStep] = useState(false)
  const [addStepType, setAddStepType] = useState<'VIDEO' | 'QUIZ'>('VIDEO')

  // Step form
  const [stepForm, setStepForm] = useState({
    title: '',
    video_url: '',
    video_required_percentage: 95,
    num_questions: 10,
    question_ids: [] as string[],
  })

  // Edit step
  const [editingStep, setEditingStep] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    video_url: '',
    video_required_percentage: 95,
    num_questions: 10,
    question_ids: [] as string[],
  })

  // Course editing
  const [editCourseInfo, setEditCourseInfo] = useState(false)
  const [courseForm, setCourseForm] = useState({ title: '', description: '', pass_score: 80 })

  // Video upload
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const addFileRef = useRef<HTMLInputElement>(null)
  const editFileRef = useRef<HTMLInputElement>(null)

  // Master questions
  const [masterQuestions, setMasterQuestions] = useState<MasterQuestion[]>([])
  const [questionsLoaded, setQuestionsLoaded] = useState(false)
  const [qSearch, setQSearch] = useState('')

  const fetchCourse = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`)
      const data = await res.json()
      setCourse(data)
      setCourseForm({
        title: data.title || '',
        description: data.description || '',
        pass_score: data.pass_score || 80,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [courseId])

  const fetchMasterQuestions = async () => {
    if (questionsLoaded) return
    try {
      const res = await fetch('/api/admin/questions')
      const data = await res.json()
      const qs = (data.questions || []).map((q: MasterQuestion) => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options as unknown as string) : q.options,
      }))
      setMasterQuestions(qs)
      setQuestionsLoaded(true)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchCourse()
  }, [fetchCourse])

  // Save course info
  const handleSaveCourseInfo = async () => {
    setSaving(true)
    try {
      await fetch(`/api/admin/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseForm),
      })
      setEditCourseInfo(false)
      fetchCourse()
    } finally {
      setSaving(false)
    }
  }

  // Add Step
  const handleAddStep = async () => {
    if (!stepForm.title) return
    setSaving(true)
    try {
      await fetch(`/api/admin/courses/${courseId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: stepForm.title,
          step_type: addStepType,
          video_url: addStepType === 'VIDEO' ? stepForm.video_url : undefined,
          video_required_percentage: addStepType === 'VIDEO' ? stepForm.video_required_percentage : undefined,
          num_questions: addStepType === 'QUIZ' ? stepForm.num_questions : undefined,
          question_ids: addStepType === 'QUIZ' ? stepForm.question_ids : undefined,
        }),
      })
      setShowAddStep(false)
      setStepForm({ title: '', video_url: '', video_required_percentage: 95, num_questions: 10, question_ids: [] })
      fetchCourse()
    } finally {
      setSaving(false)
    }
  }

  // Edit Step
  const startEditStep = (step: CourseStep) => {
    const qIds = step.question_ids
      ? (typeof step.question_ids === 'string'
        ? JSON.parse(step.question_ids as unknown as string)
        : step.question_ids)
      : []
    setEditingStep(step.id)
    setEditForm({
      title: step.title,
      video_url: step.video_url || '',
      video_required_percentage: step.video_required_percentage || 95,
      num_questions: step.num_questions || 10,
      question_ids: qIds,
    })
    if (step.step_type === 'QUIZ') fetchMasterQuestions()
  }

  const handleSaveStep = async (stepId: string) => {
    setSaving(true)
    try {
      const step = course?.steps.find(s => s.id === stepId)
      await fetch(`/api/admin/courses/${courseId}/steps/${stepId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          ...(step?.step_type === 'VIDEO' && {
            video_url: editForm.video_url,
            video_required_percentage: editForm.video_required_percentage,
          }),
          ...(step?.step_type === 'QUIZ' && {
            num_questions: editForm.num_questions,
            question_ids: editForm.question_ids,
          }),
        }),
      })
      setEditingStep(null)
      fetchCourse()
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('ต้องการลบขั้นตอนนี้?')) return
    await fetch(`/api/admin/courses/${courseId}/steps/${stepId}`, { method: 'DELETE' })
    fetchCourse()
  }

  const handleDeleteCourse = async () => {
    if (!confirm('ต้องการลบหลักสูตรนี้? ข้อมูลทั้งหมดจะถูกลบ')) return
    await fetch(`/api/admin/courses/${courseId}`, { method: 'DELETE' })
    router.push('/admin/courses')
  }

  // Move step
  const handleMoveStep = async (stepId: string, direction: 'up' | 'down') => {
    if (!course) return
    const steps = [...course.steps].sort((a, b) => a.order_num - b.order_num)
    const idx = steps.findIndex(s => s.id === stepId)
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === steps.length - 1)) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const temp = steps[idx].order_num
    steps[idx].order_num = steps[swapIdx].order_num
    steps[swapIdx].order_num = temp

    await fetch(`/api/admin/courses/${courseId}/steps`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stepOrders: steps.map(s => ({ id: s.id, order_num: s.order_num })),
      }),
    })
    fetchCourse()
  }

  // Toggle question selection for quiz step
  const toggleQuestion = (qId: string, target: 'add' | 'edit') => {
    if (target === 'add') {
      setStepForm(prev => ({
        ...prev,
        question_ids: prev.question_ids.includes(qId)
          ? prev.question_ids.filter(id => id !== qId)
          : [...prev.question_ids, qId],
      }))
    } else {
      setEditForm(prev => ({
        ...prev,
        question_ids: prev.question_ids.includes(qId)
          ? prev.question_ids.filter(id => id !== qId)
          : [...prev.question_ids, qId],
      }))
    }
  }

  // Video upload handler
  const handleVideoUpload = async (
    file: File,
    target: 'add' | 'edit'
  ) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
    if (!allowedTypes.includes(file.type)) {
      alert('รองรับเฉพาะไฟล์วิดีโอ (MP4, WebM, MOV, AVI)')
      return
    }
    if (file.size > 500 * 1024 * 1024) {
      alert('ไฟล์วิดีโอต้องไม่เกิน 500MB')
      return
    }

    setUploading(true)
    setUploadProgress(`กำลังอัปโหลด ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('courseId', courseId)

      const res = await fetch('/api/admin/video/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'อัปโหลดไม่สำเร็จ')
        return
      }

      if (target === 'add') {
        setStepForm(prev => ({ ...prev, video_url: data.url }))
      } else {
        setEditForm(prev => ({ ...prev, video_url: data.url }))
      }
      setUploadProgress('✅ อัปโหลดสำเร็จ!')
      setTimeout(() => setUploadProgress(''), 3000)
    } catch (err) {
      console.error(err)
      alert('เกิดข้อผิดพลาดในการอัปโหลด')
    } finally {
      setUploading(false)
      if (target === 'add' && addFileRef.current) addFileRef.current.value = ''
      if (target === 'edit' && editFileRef.current) editFileRef.current.value = ''
    }
  }

  const filteredQuestions = masterQuestions.filter(q =>
    q.is_active && q.question_text.toLowerCase().includes(qSearch.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-ev7-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">ไม่พบหลักสูตร</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/admin/courses')}
          className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          {editCourseInfo ? (
            <div className="space-y-3">
              <input
                type="text"
                value={courseForm.title}
                onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                className="input-field text-xl font-bold"
              />
              <textarea
                value={courseForm.description}
                onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                className="input-field text-sm"
                rows={2}
                placeholder="คำอธิบาย (ถ้ามี)"
              />
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">คะแนนผ่าน:</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={courseForm.pass_score}
                  onChange={(e) => setCourseForm({ ...courseForm, pass_score: parseInt(e.target.value) || 80 })}
                  className="input-field w-24 text-sm"
                />
                <span className="text-sm text-gray-500">%</span>
                <button onClick={handleSaveCourseInfo} disabled={saving} className="btn-primary text-sm py-1.5 px-4">
                  <Save className="w-3.5 h-3.5" />
                  บันทึก
                </button>
                <button onClick={() => setEditCourseInfo(false)} className="btn-secondary text-sm py-1.5 px-4">
                  ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
                <button onClick={() => setEditCourseInfo(true)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <Pencil className="w-4 h-4 text-gray-400" />
                </button>
                {course.is_active ? (
                  <span className="badge badge-success">เปิดใช้</span>
                ) : (
                  <span className="badge badge-gray">ปิดอยู่</span>
                )}
              </div>
              {course.description && <p className="text-sm text-gray-500 mt-1">{course.description}</p>}
              <p className="text-xs text-gray-400 mt-1">
                คะแนนผ่าน {course.pass_score}% • {course.steps.length} ขั้นตอน • {course._count.attempts} ผู้เข้าเรียน
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <div className="text-3xl font-bold text-gray-900">{course.pass_score}%</div>
          <div className="text-xs text-gray-500 mt-1">คะแนนผ่าน</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-3xl font-bold text-gray-900">{course.steps.length}</div>
          <div className="text-xs text-gray-500 mt-1">ขั้นตอน</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-3xl font-bold text-ev7-600">{course._count.attempts}</div>
          <div className="text-xs text-gray-500 mt-1">ผู้เข้าเรียน</div>
        </div>
      </div>

      {/* Steps Section */}
      <div className="stat-card p-6">
        <h2 className="font-bold text-gray-900 mb-4">โครงสร้างบทเรียน</h2>

        {course.steps.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>ยังไม่มีขั้นตอน กดปุ่มด้านล่างเพื่อเพิ่ม</p>
          </div>
        ) : (
          <div className="space-y-3">
            {course.steps.map((step, idx) => (
              <div
                key={step.id}
                className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
              >
                {editingStep === step.id ? (
                  /* Edit View */
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="input-field text-sm"
                      placeholder="ชื่อขั้นตอน"
                    />

                    {step.step_type === 'VIDEO' && (
                      <>
                        {/* Upload video */}
                        <div
                          className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                            uploading ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-ev7-400 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            ref={editFileRef}
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) handleVideoUpload(f, 'edit')
                            }}
                            className="hidden"
                            id="edit-video-upload"
                            disabled={uploading}
                          />
                          {uploading ? (
                            <div className="space-y-1">
                              <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                              <p className="text-xs text-blue-600">{uploadProgress}</p>
                            </div>
                          ) : (
                            <label htmlFor="edit-video-upload" className="cursor-pointer block">
                              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                              <p className="text-xs text-gray-600 font-medium">คลิกเพื่ออัปโหลดวิดีโอ</p>
                              <p className="text-xs text-gray-400">MP4, WebM, MOV, AVI (สูงสุด 500MB)</p>
                            </label>
                          )}
                        </div>
                        {uploadProgress && !uploading && (
                          <p className="text-xs text-green-600">{uploadProgress}</p>
                        )}
                        {/* Show current URL */}
                        {editForm.video_url && (
                          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                            <FileVideo className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <p className="text-xs text-gray-600 break-all flex-1 select-all">{editForm.video_url}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">ต้องดู:</label>
                          <input
                            type="number"
                            min={50}
                            max={100}
                            value={editForm.video_required_percentage}
                            onChange={(e) => setEditForm({ ...editForm, video_required_percentage: parseInt(e.target.value) || 95 })}
                            className="input-field w-20 text-sm"
                          />
                          <span className="text-sm text-gray-500">%</span>
                        </div>
                      </>
                    )}

                    {step.step_type === 'QUIZ' && (
                      <QuizSelector
                        questions={filteredQuestions}
                        selectedIds={editForm.question_ids}
                        numQuestions={editForm.num_questions}
                        qSearch={qSearch}
                        onSearchChange={setQSearch}
                        onToggle={(id) => toggleQuestion(id, 'edit')}
                        onNumChange={(n) => setEditForm({ ...editForm, num_questions: n })}
                      />
                    )}

                    <div className="flex gap-2">
                      <button onClick={() => handleSaveStep(step.id)} disabled={saving} className="btn-primary text-xs py-1.5 px-3">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        บันทึก
                      </button>
                      <button onClick={() => setEditingStep(null)} className="btn-secondary text-xs py-1.5 px-3">
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display View */
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMoveStep(step.id, 'up')}
                        className="p-0.5 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30"
                        disabled={idx === 0}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveStep(step.id, 'down')}
                        className="p-0.5 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30"
                        disabled={idx === course.steps.length - 1}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                      step.step_type === 'VIDEO' ? 'bg-blue-500' : 'bg-amber-500'
                    }`}>
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {step.step_type === 'VIDEO' ? (
                          <PlayCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        ) : (
                          <ClipboardCheck className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        )}
                        <span className="font-semibold text-gray-900 text-sm truncate">{step.title}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          step.step_type === 'VIDEO'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}>
                          {step.step_type === 'VIDEO' ? 'วิดีโอ' : 'แบบทดสอบ'}
                        </span>
                        {step.step_type === 'VIDEO' && step.video_url && (
                          <span className="text-xs text-gray-400">ดู {step.video_required_percentage}%</span>
                        )}
                        {step.step_type === 'QUIZ' && (
                          <span className="text-xs text-gray-400">
                            {((step.question_ids as string[]) || []).length} คำถาม
                            {step.num_questions ? ` • สุ่ม ${step.num_questions} ข้อ` : ''}
                          </span>
                        )}
                        {!step.is_required && (
                          <span className="text-xs text-gray-400 italic">ไม่บังคับ</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          startEditStep(step)
                          if (step.step_type === 'QUIZ') fetchMasterQuestions()
                        }}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteStep(step.id)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Step Button */}
        {!showAddStep ? (
          <button
            onClick={() => {
              setShowAddStep(true)
              fetchMasterQuestions()
            }}
            className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-ev7-400 hover:text-ev7-600 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            เพิ่มขั้นตอน
          </button>
        ) : (
          <div className="mt-4 border border-gray-200 rounded-xl p-5 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-4">เพิ่มขั้นตอนใหม่</h3>

            {/* Type selector */}
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setAddStepType('VIDEO')}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  addStepType === 'VIDEO'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <PlayCircle className="w-4 h-4" />
                วิดีโอ
              </button>
              <button
                onClick={() => setAddStepType('QUIZ')}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  addStepType === 'QUIZ'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                แบบทดสอบ
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">ชื่อขั้นตอน *</label>
                <input
                  type="text"
                  value={stepForm.title}
                  onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })}
                  className="input-field text-sm mt-1"
                  placeholder={addStepType === 'VIDEO' ? 'เช่น วิดีโออบรมความปลอดภัย' : 'เช่น แบบทดสอบท้ายบทที่ 1'}
                />
              </div>

              {addStepType === 'VIDEO' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700">อัปโหลดวิดีโอ</label>
                    <div
                      className={`mt-1 border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
                        uploading ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-ev7-400 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        ref={addFileRef}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) handleVideoUpload(f, 'add')
                        }}
                        className="hidden"
                        id="add-video-upload"
                        disabled={uploading}
                      />
                      {uploading ? (
                        <div className="space-y-2">
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                          <p className="text-sm text-blue-600 font-medium">{uploadProgress}</p>
                        </div>
                      ) : (
                        <label htmlFor="add-video-upload" className="cursor-pointer block space-y-1">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto">
                            <Upload className="w-5 h-5 text-gray-400" />
                          </div>
                          <p className="text-sm text-gray-600 font-medium">คลิกเพื่ออัปโหลดวิดีโอ</p>
                          <p className="text-xs text-gray-400">MP4, WebM, MOV, AVI (สูงสุด 500MB)</p>
                        </label>
                      )}
                    </div>
                    {uploadProgress && !uploading && (
                      <p className="text-xs text-green-600 mt-1">{uploadProgress}</p>
                    )}
                  </div>
                  {/* Show uploaded URL */}
                  {stepForm.video_url && (
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                      <FileVideo className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <p className="text-xs text-gray-600 break-all flex-1 select-all">{stepForm.video_url}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">ต้องดู:</label>
                    <input
                      type="number"
                      min={50}
                      max={100}
                      value={stepForm.video_required_percentage}
                      onChange={(e) => setStepForm({ ...stepForm, video_required_percentage: parseInt(e.target.value) || 95 })}
                      className="input-field w-20 text-sm"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </>
              )}

              {addStepType === 'QUIZ' && (
                <QuizSelector
                  questions={filteredQuestions}
                  selectedIds={stepForm.question_ids}
                  numQuestions={stepForm.num_questions}
                  qSearch={qSearch}
                  onSearchChange={setQSearch}
                  onToggle={(id) => toggleQuestion(id, 'add')}
                  onNumChange={(n) => setStepForm({ ...stepForm, num_questions: n })}
                />
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAddStep(false)} className="btn-secondary text-sm flex-1 py-2.5">
                  ยกเลิก
                </button>
                <button
                  onClick={handleAddStep}
                  disabled={saving || !stepForm.title}
                  className="btn-primary text-sm flex-1 py-2.5"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  เพิ่มขั้นตอน
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="border border-red-200 rounded-xl p-5 bg-red-50">
        <h3 className="font-semibold text-red-800 mb-2">พื้นที่อันตราย</h3>
        <p className="text-sm text-red-600 mb-3">การลบหลักสูตรจะลบข้อมูลทั้งหมดรวมถึงขั้นตอนและความก้าวหน้าของคนขับ</p>
        <button onClick={handleDeleteCourse} className="btn-danger text-sm py-2 px-4">
          <Trash2 className="w-4 h-4" />
          ลบหลักสูตร
        </button>
      </div>
    </div>
  )
}

// Quiz Question Selector component
function QuizSelector({
  questions,
  selectedIds,
  numQuestions,
  qSearch,
  onSearchChange,
  onToggle,
  onNumChange,
}: {
  questions: MasterQuestion[]
  selectedIds: string[]
  numQuestions: number
  qSearch: string
  onSearchChange: (v: string) => void
  onToggle: (id: string) => void
  onNumChange: (n: number) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">จำนวนที่สุ่มออกสอบ:</label>
        <input
          type="number"
          min={1}
          max={selectedIds.length || 100}
          value={numQuestions}
          onChange={(e) => onNumChange(parseInt(e.target.value) || 10)}
          className="input-field w-20 text-sm"
        />
        <span className="text-xs text-gray-400">จากทั้งหมด {selectedIds.length} ข้อที่เลือก</span>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          เลือกคำถามจาก Master ({selectedIds.length} ข้อ)
        </label>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={qSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input-field text-sm pl-9"
            placeholder="ค้นหาคำถาม..."
          />
        </div>
        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl bg-white">
          {questions.length === 0 ? (
            <p className="p-4 text-sm text-gray-400 text-center">ไม่พบคำถาม</p>
          ) : (
            questions.map((q) => (
              <label
                key={q.id}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors ${
                  selectedIds.includes(q.id) ? 'bg-ev7-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(q.id)}
                  onChange={() => onToggle(q.id)}
                  className="mt-1 w-4 h-4 rounded accent-ev7-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{q.question_text}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(q.options || []).map((opt: string, i: number) => (
                      <span
                        key={i}
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          i === q.correct_answer ? 'bg-ev7-100 text-ev7-700 font-medium' : 'text-gray-400'
                        }`}
                      >
                        {String.fromCharCode(65 + i)}. {opt}
                      </span>
                    ))}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
