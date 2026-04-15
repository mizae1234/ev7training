'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, Award, ChevronRight, CheckCircle2, Lock, BookOpen } from 'lucide-react'

interface ProgressData {
  videoProgress: number
  videoCompleted: boolean
  quizPassed: boolean
  quizAttempts: number
  maxAttempts: number
  quizScore: number | null
  certificateNo: string | null
  onboardingStatus: string
}

interface CourseItem {
  id: string
  title: string
  description: string | null
  steps: { id: string; title: string; step_type: string; completed: boolean }[]
  completedSteps: number
  totalSteps: number
  courseCompleted: boolean
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [courses, setCourses] = useState<CourseItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    try {
      const [progressRes, coursesRes] = await Promise.all([
        fetch('/api/driver/progress'),
        fetch('/api/driver/courses'),
      ])
      const progressData = await progressRes.json()
      const coursesData = await coursesRes.json()
      setProgress(progressData)
      setCourses(coursesData.courses || [])
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-ev7-500 border-t-transparent rounded-full" />
      </div>
    )
  }


  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome */}
      <div className="gradient-bg rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -mr-10 -mt-10" />
        <div className="absolute bottom-0 left-1/2 w-24 h-24 rounded-full bg-white/5" />
        <div className="relative z-10">
          <h1 className="text-2xl lg:text-3xl font-bold mb-2">
            สวัสดี, {session?.user?.name} 👋
          </h1>
          <p className="text-white/80">
            {progress?.onboardingStatus === 'PASSED'
              ? 'คุณผ่านการอบรมเรียบร้อยแล้ว!'
              : 'มาเริ่มการอบรมเพื่อรับใบ Certificate กันเลย'}
          </p>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <div className="relative mx-auto w-16 h-16 mb-2">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" stroke="#e5e7eb" strokeWidth="6" fill="none" />
              <circle
                cx="32" cy="32" r="28"
                stroke="#10b981" strokeWidth="6" fill="none"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - (progress?.videoProgress || 0) / 100)}`}
                strokeLinecap="round"
                className="progress-ring"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
              {Math.round(progress?.videoProgress || 0)}%
            </div>
          </div>
          <div className="text-xs text-gray-500">วิดีโอ</div>
        </div>

        <div className="stat-card text-center">
          <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center">
            {progress?.quizPassed ? (
              <CheckCircle2 className="w-12 h-12 text-ev7-500" />
            ) : progress?.videoCompleted ? (
              <ClipboardCheck className="w-12 h-12 text-amber-500" />
            ) : (
              <Lock className="w-12 h-12 text-gray-300" />
            )}
          </div>
          <div className="text-xs text-gray-500">
            {progress?.quizPassed ? 'สอบผ่าน' : progress?.videoCompleted ? 'พร้อมสอบ' : 'ล็อค'}
          </div>
        </div>

        <div className="stat-card text-center">
          <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center">
            {progress?.certificateNo ? (
              <Award className="w-12 h-12 text-ev7-500" />
            ) : (
              <Award className="w-12 h-12 text-gray-300" />
            )}
          </div>
          <div className="text-xs text-gray-500">
            {progress?.certificateNo ? 'ได้รับแล้ว' : 'ยังไม่ได้รับ'}
          </div>
        </div>
      </div>

      {/* Multi-Step Courses Section */}
      {courses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-ev7-600" />
            หลักสูตรอบรม
          </h2>
          {courses.map((course) => {
            const pct = course.totalSteps > 0
              ? Math.round((course.completedSteps / course.totalSteps) * 100)
              : 0
            return (
              <Link
                key={course.id}
                href={`/dashboard/courses/${course.id}`}
                className="block stat-card p-5 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    course.courseCompleted
                      ? 'bg-ev7-100 text-ev7-600'
                      : 'bg-blue-50 text-blue-600'
                  }`}>
                    {course.courseCompleted ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <BookOpen className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{course.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            course.courseCompleted ? 'bg-ev7-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {course.completedSteps}/{course.totalSteps} ขั้นตอน
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
