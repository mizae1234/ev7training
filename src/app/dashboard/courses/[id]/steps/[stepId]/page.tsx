'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, PlayCircle, CheckCircle2, AlertTriangle, Loader2,
  ClipboardCheck, XCircle, Trophy, ChevronDown, ChevronUp
} from 'lucide-react'
import { useModal } from '@/components/ui/ModalProvider'

interface StepData {
  id: string
  title: string
  step_type: 'VIDEO' | 'QUIZ'
  video_url: string | null
  video_required_percentage: number | null
  num_questions: number | null
  question_ids: string[] | null
  is_required: boolean
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
  const modal = useModal()
  const courseId = params.id as string
  const stepId = params.stepId as string

  const [step, setStep] = useState<StepData | null>(null)
  const [allSteps, setAllSteps] = useState<StepData[]>([])
  const [loading, setLoading] = useState(true)
  const [isLastStep, setIsLastStep] = useState(false)

  const fetchStep = useCallback(async () => {
    try {
      const res = await fetch(`/api/driver/courses/${courseId}`)
      if (!res.ok) { router.push('/dashboard'); return }
      const data = await res.json()
      
      const foundIdx = data.steps?.findIndex((s: StepData) => s.id === stepId)
      if (foundIdx === undefined || foundIdx === -1) { router.push(`/dashboard/courses/${courseId}`); return }
      
      const found = data.steps[foundIdx]
      if (!found.unlocked) { router.push(`/dashboard/courses/${courseId}`); return }
      
      setAllSteps(data.steps)
      setStep(found)
      setIsLastStep(foundIdx === data.steps.length - 1)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [courseId, stepId, router])

  useEffect(() => { fetchStep() }, [fetchStep])

  const handleComplete = useCallback(async (autoNext?: boolean) => {
    if (!autoNext) {
      fetchStep()
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`/api/driver/courses/${courseId}`)
      if (!res.ok) { router.push('/dashboard'); return }
      const data = await res.json()
      
      const currentIndex = data.steps?.findIndex((s: StepData) => s.id === stepId)
      if (currentIndex !== undefined && currentIndex !== -1 && currentIndex < data.steps.length - 1) {
        const nextStep = data.steps[currentIndex + 1]
        router.push(`/dashboard/courses/${courseId}/steps/${nextStep.id}`)
      } else {
        router.push(`/dashboard/certificate`)
      }
    } catch (err) {
      console.error(err)
      fetchStep()
    }
  }, [courseId, stepId, router, fetchStep])

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

      {/* Progress Steps Header */}
      {allSteps.length > 0 && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">ลำดับการเรียนรู้</span>
            <span className="text-sm text-gray-500">
              ขั้นตอนที่ {allSteps.findIndex(s => s.id === step.id) + 1} จาก {allSteps.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            {allSteps.map(s => {
              const isCurrent = s.id === step.id
              const isPast = s.completed
              const isClickable = s.unlocked && !isCurrent
              
              let bgColor = 'bg-gray-200'
              if (isCurrent) bgColor = 'bg-ev7-500' // Current active
              else if (isPast) bgColor = 'bg-ev7-300' // Already passed
              else if (s.unlocked) bgColor = 'bg-gray-300'
              
              return (
                <button 
                  key={s.id}
                  title={s.title}
                  disabled={!isClickable}
                  onClick={() => router.push(`/dashboard/courses/${courseId}/steps/${s.id}`)}
                  className={`h-2 flex-1 rounded-full transition-all outline-none ${bgColor} ${isCurrent ? 'scale-y-110 shadow-sm' : ''} ${isClickable ? 'cursor-pointer hover:bg-ev7-400' : 'cursor-not-allowed opacity-60'}`}
                />
              )
            })}
          </div>
        </div>
      )}

      {step.step_type === 'VIDEO' ? (
        <VideoPlayer step={step} courseId={courseId} stepId={stepId} onComplete={handleComplete} isLastStep={isLastStep} />
      ) : (
        <QuizPlayer step={step} courseId={courseId} stepId={stepId} onComplete={handleComplete} isLastStep={isLastStep} />
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
  isLastStep,
}: {
  step: StepData
  courseId: string
  stepId: string
  onComplete: (autoNext?: boolean) => void
  isLastStep: boolean
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
      if (isCompleted) onComplete(false)
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
          <div className="mt-4 flex flex-col gap-3 bg-ev7-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-ev7-600" />
              <div>
                <p className="font-semibold text-ev7-800">ดูวิดีโอครบแล้ว!</p>
                <p className="text-sm text-ev7-600">
                  {isLastStep ? 'คุณอบรมเสร็จแล้ว' : 'ไปทำขั้นตอนถัดไปได้เลย'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onComplete(true)}
              className="btn-primary w-full py-2 text-sm mt-1"
            >
              {isLastStep ? 'ดูใบประกาศ (กลับสู่หน้าหลัก)' : 'ไปขั้นตอนถัดไป'}
            </button>
          </div>
        )}

        {!completed && !step.is_required && (
          <div className="mt-6 border border-dashed border-gray-200 rounded-xl p-4 text-center bg-gray-50">
            <p className="text-sm text-gray-500 mb-3">วิดีโอนี้ไม่บังคับดู คุณสามารถข้ามไปขั้นตอนถัดไปได้เลย</p>
            <button
              onClick={() => onComplete(true)}
              className="btn-secondary w-full py-2.5 text-sm font-medium"
            >
              ข้ามขั้นตอนนี้ (Skip)
            </button>
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
  isLastStep,
}: {
  step: StepData
  courseId: string
  stepId: string
  onComplete: (autoNext?: boolean) => void
  isLastStep: boolean
}) {
  const router = useRouter()
  const modal = useModal()
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [currentQ, setCurrentQ] = useState(0)
  const [loadingQ, setLoadingQ] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [reviewQs, setReviewQs] = useState<any[]>([])
  const [showReview, setShowReview] = useState(false)

  useEffect(() => {
    if (step.completed || result?.passed) {
      fetch(`/api/driver/courses/${courseId}/steps/${stepId}/review`)
        .then(res => res.json())
        .then(data => {
          if (data.questions) setReviewQs(data.questions)
        })
    } else {
      fetchQuestions()
    }
  }, [step.completed, result?.passed, courseId, stepId])

  const fetchQuestions = async () => {
    try {
      const stepQIds = step.question_ids
        ? (typeof step.question_ids === 'string'
          ? JSON.parse(step.question_ids as unknown as string)
          : step.question_ids)
        : []

      if (stepQIds.length === 0) {
        setQuestions([])
        setLoadingQ(false)
        return
      }

      // Fetch questions by IDs via driver-accessible endpoint
      const res = await fetch(`/api/driver/questions?ids=${stepQIds.join(',')}`)
      const data = await res.json()
      setQuestions(data.questions || [])
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
      await modal.alert('กรุณาตอบคำถามให้ครบทุกข้อ')
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
      if (data.passed) onComplete(false)
    } catch (err) {
      console.error(err)
      await modal.alert('เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  if (step.completed || result?.passed) {
    const displayScore = result?.passed ? result.score : step.score
    return (
      <div className="max-w-2xl mx-auto py-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-ev7-100 flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-ev7-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ผ่านแล้ว!</h2>
          <p className="text-gray-500 mb-2">คะแนน: {displayScore != null ? Math.round(displayScore) : '-'}%</p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <button onClick={() => onComplete(true)} className="btn-primary py-3 px-8 text-sm w-full max-w-sm">
            {isLastStep ? 'คุณอบรมเสร็จแล้ว ดูใบประกาศ' : 'ไปขั้นตอนถัดไป'}
          </button>
          
          {reviewQs.length > 0 && (
            <button 
              onClick={() => setShowReview(!showReview)}
              className="text-ev7-600 text-sm flex items-center gap-2 hover:underline"
            >
              {showReview ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
              {showReview ? 'ซ่อนเฉลย' : 'ดูเฉลย'}
            </button>
          )}
        </div>

        {showReview && (
          <div className="space-y-6 mt-8 border-t border-gray-100 pt-8 animate-fade-in">
            <h3 className="font-bold text-lg text-gray-900">เฉลยแบบทดสอบ</h3>
          {reviewQs.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-2xl p-6 border shadow-sm">
              <p className="font-medium text-gray-900 mb-4 cursor-text select-text">
                {idx + 1}. {q.question_text}
              </p>
              <div className="space-y-2">
                {q.options.map((opt: string, optIdx: number) => {
                  const isCorrect = q.correct_answer === optIdx
                  return (
                    <div
                      key={optIdx}
                      className={`p-3 rounded-xl border flex items-center gap-3 ${
                        isCorrect
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-100 bg-gray-50 opacity-60'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                        isCorrect ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {isCorrect && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      <span className={`text-sm select-text ${isCorrect ? 'text-green-800 font-medium' : 'text-gray-600'}`}>
                        {opt}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        )}
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
        <div className="mt-8 text-center">
          <button 
            onClick={() => setShowReview(!showReview)}
            className="text-ev7-600 text-sm flex items-center gap-2 justify-center mx-auto hover:underline"
          >
            {showReview ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
            {showReview ? 'ซ่อนเฉลย' : 'ดูเฉลย'}
          </button>
        </div>

        {showReview && (
          <div className="mt-6 space-y-3 animate-fade-in">
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
        )}
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

      {!step.is_required && !step.completed && (
        <div className="mt-2 border border-dashed border-gray-200 rounded-xl p-4 text-center bg-gray-50">
          <p className="text-sm text-gray-500 mb-3">แบบทดสอบนี้ไม่บังคับทำ หากดูเป็นความรู้สามารถข้ามไปได้เลย</p>
          <button
            onClick={() => onComplete(true)}
            className="btn-secondary w-full py-2.5 text-sm font-medium"
          >
            ข้ามแบบทดสอบ (Skip)
          </button>
        </div>
      )}
    </div>
  )
}
