# EV7 Training System — Skill Document

> บันทึก Business Logic, Architecture, และ Pattern ทั้งหมดของโปรเจค EV7 Training  
> ใช้เป็น reference สำหรับ AI ในการพัฒนาต่อ

---

## 1. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.2 |
| Language | TypeScript | ^5 |
| ORM | Prisma | ^7.6.0 |
| Database | PostgreSQL | - |
| Auth | NextAuth.js | v5 beta (^5.0.0-beta.30) |
| CSS | TailwindCSS v4 | ^4 |
| Storage | S3-compatible (DigitalOcean Spaces) | @aws-sdk v3 |
| PDF | pdf-lib | ^1.17.1 |
| QR Code | qrcode | ^1.5.4 |
| Runtime | Node.js 20 | - |

> **CRITICAL**: This is Next.js 16 — API, file structure, and conventions differ from older versions.  
> Always check `node_modules/next/dist/docs/` before writing new route or middleware code.

---

## 2. Project Purpose

ระบบอบรมออนไลน์สำหรับคนขับ EV7 Taxi โดยมีขั้นตอน:
1. Login ด้วยเลขบัตรประชาชน + วันเกิด
2. ดูวิดีโออบรม (ต้องดูให้ครบ 95% — มี anti-cheat)
3. ทำแบบทดสอบ (ต้องผ่าน 80% ภายใน 3 ครั้ง)
4. รับใบ Certificate (PDF + QR Code)

---

## 3. Database Schema (Prisma)

### Models

#### `Admin`
```prisma
model Admin {
  id            String    @id @default(cuid())
  username      String    @unique
  password_hash String
  name          String
  role          AdminRole @default(ADMIN)  // SUPER_ADMIN | ADMIN
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt
  @@map("admins")
}
```

#### `Driver`
```prisma
model Driver {
  id                String           @id @default(cuid())
  full_name         String
  national_id       String           @unique
  date_of_birth     DateTime
  phone             String?
  status            DriverStatus     @default(ACTIVE)    // ACTIVE | INACTIVE
  onboarding_status OnboardingStatus @default(NOT_STARTED)  // NOT_STARTED | WATCHING | PASSED
  created_at        DateTime         @default(now())
  updated_at        DateTime         @updatedAt
  certificates      Certificate[]
  quiz_attempts     QuizAttempt[]
  video_progress    VideoProgress[]
  @@map("drivers")
}
```

#### `Video` (1 record ต่อระบบ — Global Single Video)
```prisma
model Video {
  id                        String          @id @default(cuid())
  title                     String
  url                       String          // S3 public URL
  required_watch_percentage Int             @default(95)
  is_active                 Boolean         @default(true)
  video_progress            VideoProgress[]
  @@map("videos")
}
```

#### `VideoProgress`
```prisma
model VideoProgress {
  id               String   @id @default(cuid())
  driver_id        String
  video_id         String
  max_watched_time Float    @default(0)   // วินาทีที่ดูไปมากที่สุด (anti-skip)
  total_duration   Float    @default(0)
  completed        Boolean  @default(false)
  last_position    Float    @default(0)
  updated_at       DateTime @updatedAt
  @@unique([driver_id, video_id])
  @@map("video_progress")
}
```

#### `Question` (Master Question Bank)
```prisma
model Question {
  id             String   @id @default(cuid())
  question_text  String
  options        Json     // JSON array ของ string เช่น ["ก", "ข", "ค", "ง"]
  correct_answer Int      // 0-indexed index ของ options ที่ถูก
  category       String?  // หมวดหมู่ (autocomplete ตอนเพิ่ม)
  is_active      Boolean  @default(true)
  order_num      Int      @default(0)
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt
  @@map("questions")
}
```
> **Pattern**: `options` เก็บเป็น JSON string ใน DB แต่ต้อง `JSON.parse()` เมื่ออ่านออกมา
> **Pattern**: `category` ใช้ `<datalist>` สำหรับ Auto-complete ในหน้า Admin เพื่อให้ง่ายต่อการพิมพ์หมวดหมู่เดิมที่มีอยู่

#### `QuizConfig` (Global config — 1 record)
```prisma
model QuizConfig {
  id            String   @id @default(cuid())
  pass_score    Int      @default(80)    // เปอร์เซ็นต์ขั้นต่ำที่ผ่าน
  max_attempts  Int      @default(3)     // จำนวนครั้งสูงสุดที่สอบได้
  num_questions Int      @default(10)    // จำนวนคำถามที่สุ่มออกมาสอบ
  updated_at    DateTime @updatedAt
  @@map("quiz_config")
}
```

#### `QuizAttempt`
```prisma
model QuizAttempt {
  id         String   @id @default(cuid())
  driver_id  String
  score      Float          // เปอร์เซ็นต์คะแนน (0-100)
  passed     Boolean
  attempt_no Int            // ครั้งที่สอบ (1, 2, 3)
  answers    Json           // array ของ { question_id, selected, correct, is_correct }
  created_at DateTime       @default(now())
  driver     Driver         @relation(...)
  @@map("quiz_attempts")
}
```

#### `Certificate`
```prisma
model Certificate {
  id             String            @id @default(cuid())
  certificate_no String            @unique   // รูปแบบ: EV7-2025-XXXXXX
  driver_id      String
  score          Float
  issued_at      DateTime          @default(now())
  status         CertificateStatus @default(VALID)   // VALID | REVOKED
  revoked_at     DateTime?
  revoked_reason String?
  driver         Driver            @relation(...)
  @@map("certificates")
}
```

#### `Course` & `CourseStep` (Modular Architecture)
```prisma
model Course {
  id          String   @id @default(cuid())
  title       String
  description String?  @db.Text
  pass_score  Int      @default(80)
  is_active   Boolean  @default(true)
  order_num   Int      @default(0)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  steps       CourseStep[]
  attempts    CourseAttempt[]
  @@map("courses")
}

model CourseStep {
  id                        String   @id @default(cuid())
  course_id                 String
  title                     String
  step_type                 StepType // VIDEO | QUIZ
  order_num                 Int      @default(0)
  is_required               Boolean  @default(true)
  // For VIDEO step
  video_url                 String?
  video_required_percentage Int?
  // For QUIZ step
  num_questions             Int?
  question_ids              Json?
  course                    Course               @relation(...)
  progress                  CourseStepProgress[]
  @@map("course_steps")
}

model CourseStepProgress {
  id               String   @id @default(cuid())
  driver_id        String
  step_id          String
  completed        Boolean  @default(false)
  // For VIDEO step
  max_watched_time Float?
  total_duration   Float?
  // For QUIZ step
  score            Float?
  driver           Driver     @relation(...)
  step             CourseStep @relation(...)
  @@unique([driver_id, step_id])
  @@map("course_step_progress")
}

model CourseAttempt {
  id           String    @id @default(cuid())
  driver_id    String
  course_id    String
  passed       Boolean   @default(false)
  score        Float?
  completed_at DateTime?
  created_at   DateTime  @default(now())
  driver       Driver    @relation(...)
  course       Course    @relation(...)
  @@map("course_attempts")
}
```

---

## 4. Authentication System

### สองระบบ Login แยกกัน (NextAuth v5 Credentials)

#### Driver Login
- **Provider id**: `driver-login`
- **Field**: `national_id` + `date_of_birth` (YYYY-MM-DD)
- **Logic**: หา driver ด้วย `national_id` แล้ว compare วันเกิดเป็น string
- **Session role**: `"driver"`
- **Redirect**: `/login` → `/dashboard`

```typescript
// ตัวอย่าง authorize logic
const driver = await prisma.driver.findUnique({ where: { national_id } })
const driverDob = driver.date_of_birth.toISOString().split('T')[0]
if (driverDob !== dob) return null
return { id: driver.id, name: driver.full_name, email: driver.national_id, role: 'driver' }
```

#### Admin Login
- **Provider id**: `admin-login`
- **Field**: `username` + `password`
- **Logic**: bcrypt.compare password กับ `password_hash` ใน DB
- **Master Password**: ถ้า `process.env.PASS_FOR_ALL` ตรงกับ password ที่ใส่ → ผ่านเลย (ใช้ใน dev/testing)
- **Session role**: `"admin"`
- **Redirect**: `/admin/login` → `/admin`

```typescript
const isValid =
  (process.env.PASS_FOR_ALL && password === process.env.PASS_FOR_ALL) ||
  await bcrypt.compare(password, admin.password_hash)
```

### JWT Session callbacks
```typescript
// jwt callback — เก็บ role และ id ไว้ใน token
token.role = user.role
token.id = user.id

// session callback — expose ออกมาใน session
session.user.id = token.id
session.user.role = token.role
```

### Middleware (`src/middleware.ts`)
ใช้ `auth-edge.ts` (edge-compatible, no DB) สำหรับอ่าน JWT token ใน middleware

| Path pattern | Logic |
|---|---|
| `/`, `/login`, `/admin/login`, `/verify/*`, `/api/auth/*` | Public — ไม่ check |
| `/admin/*` | ต้องมี session และ `role === 'admin'` |
| `/dashboard/*` | ต้องมี session และ `role === 'driver'` |
| `/api/admin/*` | ต้องมี session `role === 'admin'` |
| `/api/video/*`, `/api/quiz/*`, `/api/certificate/*`, `/api/driver/*` | ต้องมี session (ไม่ check role) |

### Edge Auth Pattern
```typescript
// src/lib/auth-edge.ts — ใช้ใน middleware เท่านั้น (no Prisma)
export const { auth: authMiddleware } = NextAuth({
  providers: [],  // ไม่ต้องมี provider
  session: { strategy: 'jwt' },
  secret: process.env.AUTH_SECRET,
})
```

---

## 5. Video System

### Business Logic
- มีวิดีโอ 1 ตัวสำหรับทั้งระบบ (Global Single Video)
- Driver ต้องดูให้ครบ `required_watch_percentage` (default 95%) จึงจะปลดล็อค quiz
- **Anti-cheat**: ห้าม seek ข้ามไปข้างหน้าเกิน 2 วินาทีจาก `max_watched_time`
- **Anti-cheat**: ถ้า switch tab → pause อัตโนมัติ + warning
- Progress save อัตโนมัติทุก 5 วินาที และตอน pause

### Anti-seek Pattern (client-side)
```typescript
// ถ้า current time เกิน max ที่เคยดู + 2 วินาที → rewind กลับ
if (ct > maxWatchedRef.current + 2) {
  videoRef.current.currentTime = maxWatchedRef.current
}
// update max ถ้า current > max
if (ct > maxWatchedRef.current) {
  maxWatchedRef.current = ct
}
```

### Video Upload
- อัปโหลดผ่าน `/api/admin/video/upload` → S3 multipart upload
- ขนาดสูงสุด: 500MB
- รองรับ: MP4, WebM, MOV, AVI
- `export const runtime = 'nodejs'` — ต้องกำหนดเพราะใช้ Buffer/streaming
- ใช้ `@aws-sdk/lib-storage` Upload class สำหรับ multipart (10MB parts, 4 concurrent)

### S3 URL pattern
```
https://{BUCKET}.{ENDPOINT_WITHOUT_PROTOCOL}/{key}
// key format: ev7training/video/{timestamp}_{safeName}.{ext}
```

### Config (next.config.ts)
```typescript
serverExternalPackages: ["@aws-sdk/client-s3", "@aws-sdk/lib-storage"],
experimental: {
  proxyClientMaxBodySize: "500mb",
  serverActions: { bodySizeLimit: "500mb" },
},
```

---

## 6. Quiz System

### Business Logic Flow
```
1. Driver เรียก GET /api/quiz/status → เช็ค eligibility
   - videoCompleted? (VideoProgress.completed === true)
   - attemptsUsed < maxAttempts?
   - alreadyPassed?
2. ถ้า canTakeQuiz → GET /api/quiz/questions → สุ่มคำถาม num_questions จาก active questions
3. Driver ตอบ → POST /api/quiz/submit → { answers: { questionId: selectedIndex } }
4. ถ้า passed → สร้าง Certificate + update Driver.onboarding_status = 'PASSED'
```

### Question Options Pattern
```typescript
// เก็บใน DB เป็น Json (array of string stored as JSON string)
// ตอนอ่าน:
const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options

// ตอนเขียน:
options: JSON.stringify(form.options)  // ["ก", "ข", "ค", "ง"]

// correct_answer เป็น 0-indexed integer
```

### Score Calculation
```typescript
const score = questions.length > 0 ? (correct / questions.length) * 100 : 0
const passed = score >= (quizConfig?.pass_score || 80)
```

### Certificate No Generation
```typescript
// รูปแบบ: EV7-{year}-{6 หลัก random}
export function generateCertificateNo(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(100000 + Math.random() * 900000)
  return `EV7-${year}-${random}`
}
```

---

## 7. Certificate System

- สร้างอัตโนมัติเมื่อสอบผ่าน
- รูปแบบ: `EV7-{year}-{6หลัก}` เช่น `EV7-2025-123456`
- PDF สร้างด้วย `pdf-lib`
- QR Code ใช้ `qrcode` library
- Verify page: `/verify/[certificateNo]` — public route ไม่ต้อง login
- Status: `VALID | REVOKED` (Admin revoke ได้พร้อมใส่ reason)

---

## 8. API Route Structure

### Admin APIs (ต้อง role: admin)
```
GET/PUT  /api/admin/video             — จัดการวิดีโอ global
POST     /api/admin/video/upload      — อัปโหลดวิดีโอไปยัง S3
GET/POST/PUT/DELETE /api/admin/questions — จัดการ Question Bank
GET/POST /api/admin/drivers           — list/create driver
GET/PUT  /api/admin/drivers/[id]      — ดู/แก้ driver รายคน
POST     /api/admin/drivers/import    — import Excel
GET      /api/admin/certificates      — list certificates
PUT      /api/admin/certificates/[id] — revoke certificate
```

### Driver APIs (ต้อง session ใดก็ได้)
```
GET      /api/video/current           — ดึง active video
GET/POST /api/video/progress          — ดึง/บันทึก video progress
GET      /api/quiz/status             — เช็ค eligibility
GET      /api/quiz/questions          — สุ่มคำถาม
POST     /api/quiz/submit             — ส่งคำตอบ
GET      /api/driver/progress         — ดึง progress รวมของ driver
GET      /api/certificate/[id]        — ดู certificate
GET      /api/certificate/[id]/pdf    — download PDF
```

---

## 9. Admin Panel Routes

```
/admin              — Dashboard (stats)
/admin/drivers      — จัดการคนขับ
/admin/drivers/[id] — รายละเอียดคนขับ
/admin/drivers/import — import Excel
/admin/videos       — จัดการวิดีโอ (upload + URL)
/admin/quiz         — จัดการข้อสอบ (CRUD questions + config)
/admin/certificates — จัดการใบรับรอง
```

### Admin Login
```
/admin/login — แยกจาก /login (driver login)
```

---

## 10. Driver Dashboard Routes

```
/dashboard          — Overview + Step progress
/dashboard/training — Video player page
/dashboard/quiz     — Quiz page
/dashboard/certificate — Certificate page (download PDF)
```

### Driver Status Flow
```
NOT_STARTED → WATCHING (เมื่อดูวิดีโอบางส่วน) → PASSED (เมื่อสอบผ่าน)
```

---

## 11. UI Design System

### Color palette (TailwindCSS v4 `@theme`)
```css
--color-ev7-50  → #ecfdf5  (lightest green)
--color-ev7-500 → #10b981  (primary green)
--color-ev7-600 → #059669  (dark green)
--color-ev7-700 → #047857  (darker)
```

### CSS Classes (defined in `globals.css`)
| Class | Purpose |
|---|---|
| `.btn-primary` | Green gradient button with hover lift |
| `.btn-secondary` | White + green border button |
| `.btn-danger` | Red gradient button |
| `.input-field` | White input with green focus border |
| `.stat-card` | White card with subtle shadow, hover lift |
| `.glass-card` | Glassmorphism card |
| `.badge` | Pill badge (badge-success, badge-warning, badge-danger, badge-info, badge-gray) |
| `.modal-overlay` | Fixed full-screen overlay (blur backdrop) |
| `.modal-content` | Modal content box (max-w-sm, max-h-90vh scrollable) |
| `.gradient-bg` | Green gradient (#059669 → #10b981 → #34d399) |
| `.gradient-bg-dark` | Dark green gradient |
| `.animate-fade-in` | fadeIn animation |
| `.animate-pulse-glow` | Glowing pulse (สำหรับ CTA buttons) |
| `.table-container` | Responsive table wrapper |
| `.progress-ring` | SVG circle progress animation |

### Typography
- Font: `Inter` และ `Noto Sans Thai` (TailwindCSS v4 `@theme`)
- ภาษาไทย: ใช้ `Noto Sans Thai` ผ่าน Google Fonts

---

## 12. Utility Functions (`src/lib/utils.ts`)

```typescript
cn(...inputs)                    // clsx + twMerge
maskNationalId(id)               // "1-xxxx-xxxxx-XX-x"
formatDate(date)                 // Thai locale "15 เมษายน 2568"
generateCertificateNo()          // "EV7-2025-XXXXXX"
formatPercentage(value)          // "85%"
```

---

## 13. Prisma & DB Patterns

### Prisma client singleton
```typescript
// src/lib/prisma.ts — standard singleton pattern
import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Migration Commands
```bash
npm run db:push      # push schema changes (no migration file)
npm run db:generate  # regenerate Prisma client
npm run db:seed      # run prisma/seed.ts
npm run db:studio    # open Prisma Studio
```

> **RULE** (Developer Preference): ห้าม `prisma migrate dev` โดยไม่ได้รับการอนุมัติ  
> ใช้ `prisma db push` สำหรับ development เท่านั้น

### `force-dynamic` pattern
```typescript
// ใช้ใน Server Components / API routes ที่อ่านข้อมูล real-time
export const dynamic = 'force-dynamic'
```

---

## 14. S3 / File Storage

### Environment Variables ที่ต้องใช้
```env
S3_ENDPOINT=https://sgp1.digitaloceanspaces.com
S3_REGION=sgp1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=ev7training
```

### Upload Functions
```typescript
// Small file (<50MB)
uploadToS3(key, buffer, contentType) → publicUrl

// Large file (>50MB, video)
uploadLargeToS3(key, buffer | ReadableStream, contentType) → publicUrl
// ใช้ multipart: 10MB/part, 4 concurrent uploads
```

### S3 Key Pattern
```
ev7training/video/{timestamp}_{safeName}.{ext}
```

---

## 15. Environment Variables

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=...                  # NextAuth JWT secret
PASS_FOR_ALL=...                 # Master password (override bcrypt — dev only)
S3_ENDPOINT=...
S3_REGION=sgp1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=ev7training
```

---

## 16. Deployment

### Build command
```bash
prisma generate && next build
```

### Docker
- Output mode: `standalone` (next.config.ts)
- Multi-stage Docker build
- Node.js 20

### Run dev
```bash
npm run dev  # uses --turbopack
```

---

## 17. Modular Course Architecture (Step-Based Courses)

> ใช้ออกแบบหลักสูตรเป็นขั้นตอนแบบยืดหยุ่น (Video สลับกับ Quiz ได้ไร้ขีดจำกัด)

**แนวคิด**: อาศัยข้อมูลจากตาราง `Course`, `CourseStep` และ `CourseStepProgress`

**Admin UI Pattern (Course Builder)**:
- ลิสต์หลักสูตรทั้งหมด รองรับการจัดการผ่านเมนูจุดสามจุด (Kebab Menu) สำหรับ เปิด/ปิด แก้ไข ลบ
- **Optional Knowledge Base Flow**: รองรับการสร้างหลักสูตรประเภท "ให้ความรู้" โดยตั้งค่าคะแนนผ่าน (pass_score) เท่ากับ `0` ซึ่งระบบและ UI จะแสดงผลว่า "ไม่ต้องสอบ" (หรือ "ไม่มีสอบ") อย่างสวยงาม
- เพิ่ม Step ได้ 2 แบบคือ:
  - **VIDEO**: Upload เข้า S3 ทันที (จำกัด 500MB) หรือแปะ URL พร้อมกำหนด % ความคืบหน้า (เช่น 95%) 
  - **QUIZ**: แสดง Modal เลือก Questions จากตาราง `Question` (Master Bank) ด้วย checkbox
- **Step Requirements (Lock Toggle)**: ในการเพิ่ม/แก้ไขขั้นตอนจะมี `is_required` หากติ๊กออก (ตั้งเป็น "ไม่บังคับ" / Optional) จะทำให้คนขับสามารถดูข้ามไปมาได้อย่างอิสระโดยไม่ต้องรอจบ ไม่มีการ Lock
- **Master Question Category**: การเพิ่มข้อสอบมีการผูก "หมวดหมู่ (category)" ผ่าน `<datalist>` Auto-complete เพื่อให้มีหมวดหมู่ที่เป็นมาตรฐาน จากนั้นตอนดึงคำถามมาใส่ใน Course Builder สามารถ Filter ด้วยหมวดหมู่เหล่านั้นได้

**Driver UI & Progress (Step Player)**:
- ทุกครั้งที่เริ่มเรียนระบบสร้างหรือเรียกใช้ `CourseAttempt`
- แถบ Progress Bar ด้านบน: สำหรับขั้นตอนที่ **Unlocked** แล้ว คนขับสามารถคลิกกระโดดข้ามไปดู/ทำแบบทดสอบซ้ำได้เสรี ช่วยเพิ่มประสบการณ์ให้ไม่ต้องกดกลับหน้าหลักบ่อยๆ
- **Optional Step Skip (No Lock)**: หากขั้นตอนนั้นเป็น `is_required: false` (ไม่บังคับ) ด้านล่างวิดีโอ/แบบทดสอบจะมีปุ่ม "ข้ามขั้นตอนนี้ (Skip)" นำทางคนขับไปสู่บทเรียนถัดไปทันที
- **Manual Progression**: เมื่อดูคลิปจบ หรือ สอบเสร็จ ระบบ**ไม่เปลี่ยนหน้าให้อัตโนมัติ** แต่จะปรับปุ่มให้สามารถกด "ไปขั้นตอนถัดไป" ได้เอง เพื่อไม่ให้หน้าเด้งเปลี่ยนกระทันหันเกินไป
- หน้า Quiz แสดงผลแบบ Clean UI โดยส่วนของการเฉลย "ซ่อน/พับเก็บอยู่ด้านล่าง แบบ expandable" ให้ดูรายละเอียดได้หากต้องการ
- เมื่อถึงขั้นตอนสุดท้ายและทำผ่านทุก Requirements ระบบจะ Redirect เพื่อตรวจสอบว่ามี Certificate ให้หรือไม่ (หาก Optional ล้วนอาจไม่ต้องมี Certificate ออกให้)

---

## 18. Known Patterns & Gotchas

### options field (Question)
อย่าลืม `JSON.parse()` เสมอ เพราะ Prisma คืน Json type แต่บางครั้งเป็น string:
```typescript
const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
```

### Video upload route ต้องมี runtime = 'nodejs'
```typescript
export const runtime = 'nodejs'  // ห้ามลืม — ไม่งั้น Buffer ไม่ทำงาน
```

### Admin Layout ไม่ render บน login page
```typescript
// ใน admin layout — check pathname ก่อน render sidebar
if (pathname === '/admin/login') return <>{children}</>
```

### Auth Edge vs Full Auth
- `auth-edge.ts` → ใช้ใน `middleware.ts` เท่านั้น (ไม่มี Prisma)
- `auth.ts` → ใช้ใน API routes และ Server Components (มี Prisma)

### Dashboard progress fetch
```typescript
// GET /api/driver/progress คืนข้อมูลรวม:
{
  videoProgress: number,      // % ที่ดูแล้ว
  videoCompleted: boolean,
  quizPassed: boolean,
  quizAttempts: number,
  maxAttempts: number,
  quizScore: number | null,
  certificateNo: string | null,
  onboardingStatus: string,
}
```

### Session user type
```typescript
// NextAuth session.user มี role และ id เพิ่มเติม (ต้อง cast)
session.user.id                        // string
(session.user as { role: string }).role // 'driver' | 'admin'
```

---

*อัปเดตล่าสุด: 2026-04-16*
