'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, PlayCircle, CheckCircle2, AlertTriangle, Loader2,
  ClipboardCheck, XCircle, Trophy,
} from 'lucide-react'

interface StepData {
  id: string
  title: string
  step_type: 'VIDEO' | 'QUIZ'
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

interface QuizQuestion {
  id: string
  question_text: string
  options: string[]
}

interface QuizResult {
  score: number
  passed: boolean
  answers: { question_id: string; selected: number; correct: number; is_correct: boolean }[]
  total: number
  correct: number
}

export default function StepPlayerPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string
  const stepId = params.stepId as string

  const [step, setStep] = useState<StepData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStep = useCallback(async () => {
    try {
      const res = await fetch(`/api/driver/courses/${courseId}`)
      if (!res.ok) { router.push('/dashboard'); return }
      const data = await res.json()
      const found = data.steps?.find((s: StepData) => s.id === stepId)
      if (!found || !found.unlocked) { router.push(`/dashboard/courses/${courseId}`); return }
      setStep(found)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [courseId, stepId, router])

  useEffect(() => { fetchStep() }, [fetchStep])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-ev7-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!step) return null

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/dashboard/courses/${courseId}`)}
          className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{step.title}</h1>
          <p className="text-sm text-gray-500">
            {step.step_type === 'VIDEO' ? 'วิดีโอ' : 'แบบทดสอบ'}
          </p>
        </div>
      </div>

      {step.step_type === 'VIDEO' ? (
        <VideoPlayer step={step} courseId={courseId} stepId={stepId} onComplete={fetchStep} />
      ) : (
        <QuizPlayer step={step} courseId={courseId} stepId={stepId} onComplete={fetchStep} />
      )}
    </div>
  )
}

// ================ VIDEO PLAYER ================
function VideoPlayer({
  step,
  courseId,
  stepId,
  onComplete,
}: {
  step: StepData
  courseId: string
  stepId: string
  onComplete: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [maxWatched, setMaxWatched] = useState(step.max_watched_time || 0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(step.total_duration || 0)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(step.completed)
  const [tabWarning, setTabWarning] = useState(false)
  const [saving, setSaving] = useState(false)
  const maxWatchedRef = useRef(step.max_watched_time || 0)
  const lastSaveRef = useRef(0)
  const requiredPercent = step.video_required_percentage || 95

  // Anti-cheat tab switch
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        videoRef.current?.pause()
        setTabWarning(true)
        setTimeout(() => setTabWarning(false), 3000)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
      if (maxWatchedRef.current > 0) {
        videoRef.current.currentTime = Math.min(maxWatchedRef.current, videoRef.current.duration)
      }
    }
  }

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return
    const ct = videoRef.current.currentTime
    const dur = videoRef.current.duration

    if (ct > maxWatchedRef.current + 2) {
      videoRef.current.currentTime = maxWatchedRef.current
      return
    }

    if (ct > maxWatchedRef.current) {
      maxWatchedRef.current = ct
      setMaxWatched(ct)
    }

    setCurrentTime(ct)
    const prog = dur > 0 ? (maxWatchedRef.current / dur) * 100 : 0
    setProgress(prog)

    const now = Date.now()
    if (now - lastSaveRef.current > 5000) {
      lastSaveRef.current = now
      saveProgress(maxWatchedRef.current, dur, prog >= requiredPercent)
    }

    if (prog >= requiredPercent && !completed) {
      setCompleted(true)
      saveProgress(maxWatchedRef.current, dur, true)
    }
  }, [completed, requiredPercent])

  const handleSeeking = () => {
    if (!videoRef.current) return
    if (videoRef.current.currentTime > maxWatchedRef.current + 1) {
      videoRef.current.currentTime = maxWatchedRef.current
    }
  }

  const saveProgress = async (watchedTime: number, totalDur: number, isCompleted: boolean) => {
    if (saving) return
    setSaving(true)
    try {
      await fetch(`/api/driver/courses/${courseId}/steps/${stepId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_watched_time: watchedTime,
          total_duration: totalDur,
          completed: isCompleted,
        }),
      })
      if (isCompleted) onComplete()
    } finally {
      setSaving(false)
    }
  }

  const handlePause = () => {
    if (videoRef.current && duration > 0) {
      saveProgress(maxWatchedRef.current, duration, progress >= requiredPercent)
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <>
      {tabWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-amber-700 text-sm">ตรวจพบการสลับแท็บ วิดีโอถูกหยุดชั่วคราว</p>
        </div>
      )}

      <div className="bg-black rounded-2xl overflow-hidden shadow-xl aspect-video flex items-center justify-center">
        {step.video_url ? (
          <video
            ref={videoRef}
            src={step.video_url}
            controls
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onSeeking={handleSeeking}
            onPause={handlePause}
            controlsList="nodownload nofullscreen"
            disablePictureInPicture
            playsInline
            className="w-full h-full"
            style={{ maxHeight: '70vh' }}
          />
        ) : (
          <div className="text-gray-400">ยังไม่มี URL วิดีโอ</div>
        )}
      </div>

      {/* Progress */}
      <div className="stat-card p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700">ความคืบหน้า</span>
          <span className={`text-sm font-bold ${progress >= requiredPercent ? 'text-ev7-600' : 'text-gray-500'}`}>
            {Math.round(progress)}% / {requiredPercent}%
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress >= requiredPercent
                ? 'bg-gradient-to-r from-ev7-500 to-ev7-400'
                : 'bg-gradient-to-r from-blue-500 to-blue-400'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {completed && (
          <div className="mt-4 flex items-center gap-3 bg-ev7-50 rounded-xl p-4">
            <CheckCircle2 className="w-6 h-6 text-ev7-600" />
            <div>
              <p className="font-semibold text-ev7-800">ดูวิดีโอครบแล้ว!</p>
              <p className="text-sm text-ev7-600">ไปทำขั้นตอนถัดไปได้เลย</p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ================ QUIZ PLAYER ================
function QuizPlayer({
  step,
  courseId,
  stepId,
  onComplete,
}: {
  step: StepData
  courseId: string
  stepId: string
  onComplete: () => void
}) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [currentQ, setCurrentQ] = useState(0)
  const [loadingQ, setLoadingQ] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<QuizResult | null>(null)

  useEffect(() => {
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    try {
      // Get master questions that belong to this step
      const res = await fetch('/api/quiz/questions')
      const data = await res.json()
      const allQs = data.questions || []

      const stepQIds = step.question_ids
        ? (typeof step.question_ids === 'string'
          ? JSON.parse(step.question_ids as unknown as string)
          : step.question_ids)
        : []

      let filtered = allQs
      if (stepQIds.length > 0) {
        filtered = allQs.filter((q: QuizQuestion) => stepQIds.includes(q.id))
      }

      // Shuffle and pick
      const shuffled = filtered.sort(() => Math.random() - 0.5)
      const pick = step.num_questions ? shuffled.slice(0, step.num_questions) : shuffled
      setQuestions(pick)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingQ(false)
    }
  }

  const handleAnswer = (qId: string, optIdx: number) => {
    setAnswers(prev => ({ ...prev, [qId]: optIdx }))
  }

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      alert('กรุณาตอบคำถามให้ครบทุกข้อ')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/driver/courses/${courseId}/steps/${stepId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      setResult(data)
      if (data.passed) onComplete()
    } catch (err) {
      console.error(err)
      alert('เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  if (step.completed) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="w-20 h-20 rounded-full bg-ev7-100 flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-10 h-10 text-ev7-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">ผ่านแล้ว!</h2>
        <p className="text-gray-500 mb-2">คะแนน: {step.score != null ? Math.round(step.score) : '-'}%</p>
      </div>
    )
  }

  if (loadingQ) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-ev7-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto py-8 animate-fade-in">
        <div className={`text-center p-8 rounded-3xl ${result.passed ? 'bg-ev7-50' : 'bg-red-50'}`}>
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
            result.passed ? 'bg-ev7-100' : 'bg-red-100'
          }`}>
            {result.passed ? (
              <Trophy className="w-12 h-12 text-ev7-600" />
            ) : (
              <XCircle className="w-12 h-12 text-red-500" />
            )}
          </div>
          <h2 className="text-3xl font-bold mb-2">
            {result.passed ? '🎉 ผ่านแล้ว!' : '😢 ยังไม่ผ่าน'}
          </h2>
          <p className="text-lg text-gray-600 mb-2">
            คะแนน: <span className="font-bold text-2xl">{Math.round(result.score)}%</span>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            ถูก {result.correct} จาก {result.total} ข้อ
          </p>

          {!result.passed && (
            <button
              onClick={() => {
                setResult(null)
                setAnswers({})
                setCurrentQ(0)
                fetchQuestions()
              }}
              className="btn-primary py-3 px-8"
            >
              ลองใหม่
            </button>
          )}
        </div>

        {/* Answer review */}
        <div className="mt-8 space-y-3">
          <h3 className="font-bold text-gray-900">เฉลย</h3>
          {result.answers.map((a, i) => (
            <div key={i} className={`p-4 rounded-xl border-2 ${a.is_correct ? 'border-ev7-200 bg-ev7-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-start gap-2">
                {a.is_correct ? (
                  <CheckCircle2 className="w-5 h-5 text-ev7-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">ข้อ {i + 1}</p>
                  {!a.is_correct && (
                    <p className="text-xs text-gray-500 mt-1">คำตอบที่ถูก: ตัวเลือก {String.fromCharCode(65 + a.correct)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Quiz form
  const question = questions[currentQ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{questions.length} ข้อ</p>
        <span className="text-sm text-gray-400">ตอบแล้ว {Object.keys(answers).length}/{questions.length}</span>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1">
        {questions.map((q, i) => (
          <div
            key={q.id}
            className={`h-2 flex-1 rounded-full cursor-pointer transition-all ${
              answers[q.id] !== undefined
                ? 'bg-ev7-500'
                : i === currentQ
                  ? 'bg-ev7-300'
                  : 'bg-gray-200'
            }`}
            onClick={() => setCurrentQ(i)}
          />
        ))}
      </div>

      {question && (
        <div className="stat-card p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="badge badge-info">ข้อที่ {currentQ + 1}/{questions.length}</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-6">{question.question_text}</h3>
          <div className="space-y-3">
            {question.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(question.id, i)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  answers[question.id] === i
                    ? 'border-ev7-500 bg-ev7-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    answers[question.id] === i
                      ? 'bg-ev7-500 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  <span className="text-sm">{opt}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
          className="btn-secondary flex-1 py-3 disabled:opacity-50"
        >
          ← ข้อก่อนหน้า
        </button>
        {currentQ < questions.length - 1 ? (
          <button
            onClick={() => setCurrentQ(currentQ + 1)}
            className="btn-primary flex-1 py-3"
          >
            ข้อถัดไป →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || Object.keys(answers).length < questions.length}
            className="btn-primary flex-1 py-3"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> กำลังตรวจ...</>
            ) : (
              `ส่งคำตอบ (${Object.keys(answers).length}/${questions.length})`
            )}
          </button>
        )}
      </div>
    </div>
  )
}
