'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Car, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [nationalId, setNationalId] = useState('')
  const [dob, setDob] = useState('') // raw digits ddmmyyyy
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)


  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8)
    setDob(raw)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (nationalId.length !== 13) {
      setError('กรุณากรอกเลขบัตรประชาชน 13 หลัก')
      setLoading(false)
      return
    }

    if (dob.length !== 8) {
      setError('กรุณากรอกวันเดือนปีเกิดให้ครบ 8 หลัก')
      setLoading(false)
      return
    }

    // Parse ddmmyyyy Buddhist Era -> yyyy-mm-dd Christian Era
    const dd = dob.slice(0, 2)
    const mm = dob.slice(2, 4)
    const buddhistYear = parseInt(dob.slice(4, 8), 10)
    const christianYear = buddhistYear - 543
    const isoDate = `${christianYear}-${mm}-${dd}`

    // Validate date
    const parsed = new Date(isoDate)
    if (isNaN(parsed.getTime()) || parsed.toISOString().split('T')[0] !== isoDate) {
      setError('วันเดือนปีเกิดไม่ถูกต้อง')
      setLoading(false)
      return
    }

    try {
      const result = await signIn('driver-login', {
        national_id: nationalId,
        date_of_birth: isoDate,
        redirect: false,
      })

      if (result?.error) {
        setError('ไม่พบข้อมูลในระบบ หรือวันเกิดไม่ถูกต้อง')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      {/* Decorative */}
      <div className="absolute top-20 right-20 w-72 h-72 rounded-full bg-white/10 blur-sm hidden md:block" />
      <div className="absolute bottom-20 left-20 w-96 h-96 rounded-full bg-white/5 hidden md:block" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Car className="w-8 h-8 text-white" />
            </div>
            <span className="text-3xl font-extrabold text-white">EV7</span>
          </Link>
          <p className="text-white/70 mt-3">ระบบอบรมคนขับ EV7</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 animate-fade-in">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">เข้าสู่ระบบ</h2>
          <p className="text-gray-500 mb-6 text-sm">กรอกเลขบัตรประชาชนและวันเกิดเพื่อเข้าสู่ระบบ</p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                เลขบัตรประชาชน
              </label>
              <input
                type="text"
                maxLength={13}
                placeholder="กรอกเลขบัตรประชาชน 13 หลัก"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                className="input-field font-mono text-lg tracking-wider"
                required
              />
              <p className="text-xs text-gray-400 mt-1">{nationalId.length}/13 หลัก</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                วันเดือนปีเกิด (พ.ศ.)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="เช่น 15032528"
                value={dob}
                onChange={handleDobChange}
                className="input-field font-mono text-lg tracking-wider"
              />
              <p className="text-xs text-gray-400 mt-1">{dob.length}/8 หลัก (วันเดือนปี พ.ศ.)</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 text-lg rounded-2xl"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  กำลังตรวจสอบ...
                </>
              ) : (
                'เข้าสู่ระบบ'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              หากยังไม่มีข้อมูลในระบบ กรุณาติดต่อ EV7
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-white/70 hover:text-white text-sm transition-colors">
            ← กลับหน้าแรก
          </Link>
        </div>
      </div>
    </div>
  )
}
