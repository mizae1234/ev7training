'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ClipboardCheck, Loader2, Save, CheckCircle2, X } from 'lucide-react'

interface Question {
  id: string
  question_text: string
  options: string[]
  correct_answer: number
  is_active: boolean
  order_num: number
}

interface QuizConfig {
  pass_score: number
  max_attempts: number
  num_questions: number
}

export default function QuizManagementPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [config, setConfig] = useState<QuizConfig>({ pass_score: 80, max_attempts: 3, num_questions: 10 })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    question_text: '',
    options: ['', '', '', ''],
    correct_answer: 0,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/questions')
      const data = await res.json()
      setQuestions(data.questions || [])
      if (data.config) setConfig(data.config)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!form.question_text || form.options.some(o => !o)) {
      alert('กรุณากรอกข้อมูลให้ครบ')
      return
    }

    const method = editingId ? 'PUT' : 'POST'
    const body = editingId
      ? { id: editingId, ...form, options: JSON.stringify(form.options) }
      : { ...form, options: JSON.stringify(form.options) }

    await fetch('/api/admin/questions', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setShowForm(false)
    setEditingId(null)
    setForm({ question_text: '', options: ['', '', '', ''], correct_answer: 0 })
    fetchData()
  }

  const handleEdit = (q: Question) => {
    const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
    setForm({
      question_text: q.question_text,
      options: opts,
      correct_answer: q.correct_answer,
    })
    setEditingId(q.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ต้องการลบคำถามนี้?')) return
    await fetch(`/api/admin/questions?id=${id}`, { method: 'DELETE' })
    fetchData()
  }

  const handleToggleActive = async (q: Question) => {
    await fetch('/api/admin/questions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: q.id, is_active: !q.is_active }),
    })
    fetchData()
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
          <h1 className="text-2xl font-bold text-gray-900">จัดการข้อสอบ</h1>
          <p className="text-gray-500 text-sm">{questions.length} คำถาม | ผ่าน {config.pass_score}% | สอบได้ {config.max_attempts} ครั้ง</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ question_text: '', options: ['', '', '', ''], correct_answer: 0 }) }}
          className="btn-primary text-sm py-2 px-4"
        >
          <Plus className="w-4 h-4" />
          เพิ่มคำถาม
        </button>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {questions.map((q, i) => {
          const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
          return (
            <div key={q.id} className={`stat-card p-4 ${!q.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-400 font-mono">#{i + 1}</span>
                    {!q.is_active && <span className="badge badge-gray">ปิดใช้งาน</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{q.question_text}</p>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {opts.map((opt: string, j: number) => (
                      <span key={j} className={`text-xs px-2 py-1 rounded ${j === q.correct_answer ? 'bg-ev7-100 text-ev7-700 font-semibold' : 'text-gray-500'}`}>
                        {String.fromCharCode(65 + j)}. {opt}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleToggleActive(q)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title={q.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}>
                    {q.is_active ? <CheckCircle2 className="w-4 h-4 text-ev7-500" /> : <X className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleEdit(q)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(q.id)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editingId ? 'แก้ไขคำถาม' : 'เพิ่มคำถาม'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">คำถาม *</label>
                <textarea
                  value={form.question_text}
                  onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                  className="input-field min-h-[80px]"
                  rows={3}
                />
              </div>

              {form.options.map((opt, i) => (
                <div key={i}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    ตัวเลือก {String.fromCharCode(65 + i)} *
                    {form.correct_answer === i && <span className="text-ev7-600 ml-2">✓ คำตอบที่ถูก</span>}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...form.options]
                        newOpts[i] = e.target.value
                        setForm({ ...form, options: newOpts })
                      }}
                      className="input-field flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, correct_answer: i })}
                      className={`px-3 rounded-xl text-sm font-medium transition-all ${
                        form.correct_answer === i
                          ? 'bg-ev7-500 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      ✓
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 py-3">ยกเลิก</button>
                <button onClick={handleSave} className="btn-primary flex-1 py-3">บันทึก</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
