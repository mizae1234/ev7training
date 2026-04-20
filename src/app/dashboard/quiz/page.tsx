'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, AlertCircle, Loader2, Lock, Trophy } from 'lucide-react'
import { useModal } from '@/components/ui/ModalProvider'

interface Question {
  id: string
  question_text: string
  options: string[]
  optionsList?: { text: string; originalIndex: number }[]
}

interface QuizResult {
  score: number
  passed: boolean
  attempt_no: number
  answers: { question_id: string; selected: number; correct: number; is_correct: boolean }[]
}

export default function QuizPage() {
  const router = useRouter()
  const modal = useModal()
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [canTakeQuiz, setCanTakeQuiz] = useState(false)
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [maxAttempts, setMaxAttempts] = useState(3)
  const [passScore, setPassScore] = useState(80)
  const [alreadyPassed, setAlreadyPassed] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)

  useEffect(() => {
    checkEligibility()
  }, [])

  const checkEligibility = async () => {
    try {
      const res = await fetch('/api/quiz/status')
      const data = await res.json()

      setCanTakeQuiz(data.canTakeQuiz)
      setAttemptsUsed(data.attemptsUsed)
      setMaxAttempts(data.maxAttempts)
      setPassScore(data.passScore)
      setAlreadyPassed(data.alreadyPassed)

      if (data.canTakeQuiz && !data.alreadyPassed) {
        fetchQuestions()
      } else {
        setLoading(false)
      }
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/quiz/questions')
      const data = await res.json()
      const qs = (data.questions || []).map((q: any) => {
        const optionObjs = q.options.map((t: string, i: number) => ({ text: t, originalIndex: i }))
        const shuffledOptions = [...optionObjs].sort(() => Math.random() - 0.5)
        return { ...q, optionsList: shuffledOptions }
      })
      setQuestions(qs)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }))
  }

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      await modal.alert('กรุณาตอบคำถามให้ครบทุกข้อ')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      console.error(err)
      await modal.alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-ev7-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Already passed
  if (alreadyPassed) {
    return (
      <div className="max-w-md mx-auto text-center py-12 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-ev7-100 flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-10 h-10 text-ev7-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">คุณสอบผ่านแล้ว!</h2>
        <p className="text-gray-500 mb-6">คุณได้ผ่านการทดสอบเรียบร้อยแล้ว</p>
        <button
          onClick={() => router.push('/dashboard/certificate')}
          className="btn-primary py-3 px-8"
        >
          ดูใบ Certificate
        </button>
      </div>
    )
  }

  // Cannot take quiz
  if (!canTakeQuiz) {
    return (
      <div className="max-w-md mx-auto text-center py-12 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {attemptsUsed >= maxAttempts ? 'ใช้สิทธิ์สอบครบแล้ว' : 'ยังไม่สามารถทำแบบทดสอบได้'}
        </h2>
        <p className="text-gray-500 mb-6">
          {attemptsUsed >= maxAttempts 
            ? `คุณได้ทำแบบทดสอบครบ ${maxAttempts} ครั้งแล้ว กรุณาติดต่อแอดมิน`
            : 'กรุณาดูวิดีโออบรมให้ครบ 95% ก่อนทำแบบทดสอบ'
          }
        </p>
        <button
          onClick={() => router.push('/dashboard/training')}
          className="btn-secondary py-3 px-8"
        >
          กลับไปดูวิดีโอ
        </button>
      </div>
    )
  }

  // Show result
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
            {result.passed ? '🎉 ยินดีด้วย!' : '😢 ยังไม่ผ่าน'}
          </h2>
          <p className="text-lg text-gray-600 mb-2">
            คะแนนของคุณ: <span className="font-bold text-2xl">{Math.round(result.score)}%</span>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            เกณฑ์ผ่าน: {passScore}% | ครั้งที่: {result.attempt_no}/{maxAttempts}
          </p>

          {result.passed ? (
            <button
              onClick={() => router.push('/dashboard/certificate')}
              className="btn-primary py-3 px-8"
            >
              ดูใบ Certificate
            </button>
          ) : attemptsUsed + 1 < maxAttempts ? (
            <button
              onClick={() => {
                setResult(null)
                setAnswers({})
                setCurrentQuestion(0)
                fetchQuestions()
              }}
              className="btn-primary py-3 px-8"
            >
              ลองใหม่อีกครั้ง
            </button>
          ) : (
            <p className="text-red-600 font-semibold">ใช้สิทธิ์สอบครบแล้ว กรุณาติดต่อแอดมิน</p>
          )}
        </div>

        {/* Answer Review */}
        <div className="mt-8 space-y-3">
          <h3 className="font-bold text-gray-900">เฉลย</h3>
          {questions.map((q, i) => {
            const a = result.answers.find(ans => ans.question_id === q.id)
            if (!a) return null
            return (
              <div key={i} className={`p-4 rounded-xl border-2 ${a.is_correct ? 'border-ev7-200 bg-ev7-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-start gap-2">
                  {a.is_correct ? (
                    <CheckCircle2 className="w-5 h-5 text-ev7-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">ข้อ {i + 1}. {q.question_text}</p>
                    {!a.is_correct && (
                      <p className="text-sm text-ev7-700 mt-1 font-medium bg-ev7-100 px-2 py-1 rounded inline-block">
                        คำตอบที่ถูก: {q.options[a.correct]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Quiz Form
  const question = questions[currentQuestion]

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">แบบทดสอบ</h1>
        <p className="text-gray-500 text-sm">
          ตอบคำถาม {questions.length} ข้อ ต้องได้ {passScore}% ขึ้นไป | 
          ครั้งที่ {attemptsUsed + 1}/{maxAttempts}
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {questions.map((q, i) => (
          <div
            key={q.id}
            className={`h-2 flex-1 rounded-full cursor-pointer transition-all ${
              answers[q.id] !== undefined
                ? 'bg-ev7-500'
                : i === currentQuestion
                  ? 'bg-ev7-300'
                  : 'bg-gray-200'
            }`}
            onClick={() => setCurrentQuestion(i)}
          />
        ))}
      </div>

      {/* Question Card */}
      {question && (
        <div className="stat-card p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="badge badge-info">ข้อที่ {currentQuestion + 1}/{questions.length}</span>
            <span className="text-sm text-gray-400">
              ตอบแล้ว {Object.keys(answers).length}/{questions.length}
            </span>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-6">{question.question_text}</h3>

          <div className="space-y-3">
            {question.optionsList?.map((opt, i) => (
              <button
                key={opt.originalIndex}
                onClick={() => handleAnswer(question.id, opt.originalIndex)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  answers[question.id] === opt.originalIndex
                    ? 'border-ev7-500 bg-ev7-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    answers[question.id] === opt.originalIndex
                      ? 'bg-ev7-500 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  <span className="text-sm">{opt.text}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
          disabled={currentQuestion === 0}
          className="btn-secondary flex-1 py-3 disabled:opacity-50"
        >
          ← ข้อก่อนหน้า
        </button>
        {currentQuestion < questions.length - 1 ? (
          <button
            onClick={() => setCurrentQuestion(currentQuestion + 1)}
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
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังตรวจ...
              </>
            ) : (
              `ส่งคำตอบ (${Object.keys(answers).length}/${questions.length})`
            )}
          </button>
        )}
      </div>
    </div>
  )
}
