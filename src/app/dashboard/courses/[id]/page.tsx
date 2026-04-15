'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, PlayCircle, ClipboardCheck, CheckCircle2, Lock,
  ChevronRight, BookOpen, Loader2,
} from 'lucide-react'

interface StepWithProgress {
  id: string
  title: string
  step_type: 'VIDEO' | 'QUIZ'
  order_num: number
  is_required: boolean
  video_url: string | null
  video_required_percentage: number | null
  num_questions: number | null
  question_ids: string[] | null
  completed: boolean
  score: number | null
  max_watched_time: number | null
  total_duration: number | null
  unlocked: boolean
}

interface CourseDetail {
  id: string
  title: string
  description: string | null
  pass_score: number
  steps: StepWithProgress[]
}

export default function DriverCoursePage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCourse = useCallback(async () => {
    try {
      const res = await fetch(`/api/driver/courses/${courseId}`)
      if (!res.ok) {
        router.push('/dashboard')
        return
      }
      const data = await res.json()
      setCourse(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [courseId, router])

  useEffect(() => {
    fetchCourse()
  }, [fetchCourse])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
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

  const completedSteps = course.steps.filter(s => s.completed && s.is_required).length
  const totalRequiredSteps = course.steps.filter(s => s.is_required).length
  const progress = totalRequiredSteps > 0 ? (completedSteps / totalRequiredSteps) * 100 : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{course.title}</h1>
          {course.description && <p className="text-sm text-gray-500 mt-0.5">{course.description}</p>}
        </div>
      </div>

      {/* Progress Card */}
      <div className="gradient-bg rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -mr-8 -mt-8" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/80">ความคืบหน้า</span>
            <span className="text-sm font-bold">{completedSteps}/{totalRequiredSteps} ขั้นตอน</span>
          </div>
          <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-right mt-1 text-xs text-white/60">{Math.round(progress)}%</div>
        </div>
      </div>

      {/* Step List */}
      <div className="space-y-3">
        <h2 className="font-bold text-gray-900">ขั้นตอนการเรียน</h2>
        {course.steps.map((step, idx) => {
          const isVideo = step.step_type === 'VIDEO'
          const StepIcon = isVideo ? PlayCircle : ClipboardCheck

          let statusIcon
          let statusColor = ''
          if (step.completed) {
            statusIcon = <CheckCircle2 className="w-6 h-6 text-ev7-600" />
            statusColor = 'border-ev7-200 bg-ev7-50'
          } else if (step.unlocked) {
            statusIcon = <StepIcon className={`w-6 h-6 ${isVideo ? 'text-blue-500' : 'text-amber-500'}`} />
            statusColor = 'border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer'
          } else {
            statusIcon = <Lock className="w-6 h-6 text-gray-300" />
            statusColor = 'border-gray-100 bg-gray-50 opacity-60'
          }

          let subtitle = ''
          if (step.completed) {
            if (step.step_type === 'QUIZ' && step.score != null) {
              subtitle = `ผ่านแล้ว • คะแนน ${Math.round(step.score)}%`
            } else {
              subtitle = 'เสร็จสิ้น ✓'
            }
          } else if (step.step_type === 'VIDEO' && step.max_watched_time && step.total_duration) {
            const pct = (step.max_watched_time / step.total_duration) * 100
            subtitle = `ดูไปแล้ว ${Math.round(pct)}%`
          } else if (!step.unlocked) {
            subtitle = 'ต้องทำขั้นตอนก่อนหน้าก่อน'
          } else {
            subtitle = isVideo ? 'กดเพื่อเริ่มดูวิดีโอ' : 'กดเพื่อเริ่มทำแบบทดสอบ'
          }

          return (
            <Link
              key={step.id}
              href={step.unlocked ? `/dashboard/courses/${courseId}/steps/${step.id}` : '#'}
              className={`block border-2 rounded-xl p-4 transition-all ${statusColor} ${!step.unlocked ? 'pointer-events-none' : ''}`}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  step.completed ? 'bg-ev7-100' : isVideo ? 'bg-blue-50' : 'bg-amber-50'
                }`}>
                  {statusIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono">{idx + 1}</span>
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{step.title}</h3>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isVideo ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {isVideo ? 'วิดีโอ' : 'แบบทดสอบ'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
                </div>
                {step.unlocked && !step.completed && (
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
