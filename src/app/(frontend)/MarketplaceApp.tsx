'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Bell,
  Bookmark,
  Check,
  Clock,
  Eye,
  Menu,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  applyToJobAction,
  createReviewAction,
  getMarketplaceSessionAction,
  createJobAction,
  createAdminAction,
  loginAction,
  logoutAction,
  signupAction,
  verifyEmailCodeAction,
  resendVerificationCodeAction,
  requestPasswordResetAction,
  resetPasswordWithOtpAction,
  moderateJobAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  saveJobAction,
  updateProfileAction,
  updateReviewAction,
  updateUserAction,
  updateApplicationStatusAction,
  updateEmployerJobStatusAction,
  unsaveJobAction,
  type NotificationItem,
  type UserProfileData,
  type VerificationPendingData,
} from './actions'

type Page =
  | 'jobs'
  | 'detail'
  | 'applications'
  | 'saved'
  | 'profile'
  | 'employer'
  | 'post-job'
  | 'candidates'
  | 'signup'
  | 'verify-email'
  | 'forgot-password'
  | 'login'
  | 'admin'
  | 'admin-users'
  | 'admin-jobs'
  | 'admin-reviews'

type AuthRole = 'guest' | 'student' | 'employer' | 'admin'

type Job = {
  id: string
  company: string
  title: string
  pay: string
  hourlyRate: number
  place: string
  schedule: string
  category: string
  posted: string
  createdAt?: string
  description: string
}

type AdminUserRow = {
  id: string
  name: string
  email: string
  role: 'student' | 'employer' | 'admin'
  active: boolean
}

type AdminJobRow = {
  id: string
  title: string
  company: string
  pay: string
  hourlyRate?: number
  place?: string
  schedule?: string
  category?: string
  posted?: string
  createdAt?: string
  description?: string
  requirements?: string
  openings?: number
  status: string
}

type AdminReviewRow = {
  id: string
  applicationId?: string
  reviewType?: 'employer-to-student' | 'student-to-employer'
  author: string
  target: string
  rating: number
  content: string
  status: string
}

type ReviewData = {
  id?: string
  rating: number
  comment: string
  date: string
  reviewerName: string
  moderationStatus?: 'pending' | 'approved' | 'hidden'
}

type ApplicationRow = {
  id: string
  jobId: string
  title: string
  company: string
  date: string
  status: 'pending' | 'hired' | 'rejected' | 'completed'
  studentName: string
  studentSchool: string
  introduction: string
  pay: string
  place: string
  schedule: string
  openings: number
  hasCV: boolean
  cvName?: string
  cvUrl?: string
  employerReview?: ReviewData
  studentReview?: ReviewData
}

type SavedJobRow = { id: string; jobId: string }
type NotificationRow = NotificationItem
type EmployerJobRow = Job & {
  status: 'recruiting' | 'paused' | 'filled' | 'completed'
  moderationStatus: 'pending' | 'approved' | 'rejected'
  openings: number
  applicationCount: number
}

const SESSION_STORAGE_KEY = 'shiftly_active_session'
const PAGE_STORAGE_KEY = 'shiftly_current_page'
const SEARCH_HISTORY_KEY = 'shiftly_search_history_v1'
const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024
const JOBS_PER_PAGE = 6

type PersistedSession = {
  email: string
  password: string
  name?: string
  role?: AuthRole
}

function readPersistedSession(): PersistedSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedSession
    if (parsed && typeof parsed.email === 'string' && parsed.email.trim()) {
      return parsed
    }
  } catch {
    // ignore storage errors
  }
  return null
}

function writePersistedSession(session: PersistedSession | null) {
  if (typeof window === 'undefined') return
  try {
    if (!session) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      window.localStorage.removeItem(PAGE_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // ignore storage errors
  }
}

function readPersistedPage(): Page | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PAGE_STORAGE_KEY) as Page | null
    if (raw) return raw
  } catch {
    // ignore storage errors
  }
  return null
}

function writePersistedPage(nextPage: Page) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PAGE_STORAGE_KEY, nextPage)
  } catch {
    // ignore storage errors
  }
}

const jobCategories = [
  'Tất cả ngành nghề',
  'F&B / Phục vụ',
  'Bán hàng / Thu ngân',
  'Gia sư / Trợ giảng',
  'Marketing / Content',
  'Sự kiện / Lễ tân',
  'Kho vận / Giao nhận',
  'Thiết kế / Đồ họa',
  'Hành chính / Nhập liệu',
  'Chăm sóc khách hàng / Tư vấn',
  'Công nghệ thông tin',
  'Media / Quay dựng video',
]

const PAY_UNITS = ['K / giờ', 'K / ca', 'Triệu / tháng'] as const
type PayUnit = (typeof PAY_UNITS)[number]

const QUICK_PAY_PRESETS = [
  { label: 'Từ 20K/giờ', min: '20', max: '', unit: 'K / giờ' as const },
  { label: 'Từ 30K/giờ', min: '30', max: '', unit: 'K / giờ' as const },
  { label: '25K – 45K/giờ', min: '25', max: '45', unit: 'K / giờ' as const },
  { label: 'Từ 150K/ca', min: '150', max: '', unit: 'K / ca' as const },
  { label: 'Từ 5 Triệu/tháng', min: '5', max: '', unit: 'Triệu / tháng' as const },
]

const WORK_DAYS = [
  { value: 'T2', label: 'Thứ 2' },
  { value: 'T3', label: 'Thứ 3' },
  { value: 'T4', label: 'Thứ 4' },
  { value: 'T5', label: 'Thứ 5' },
  { value: 'T6', label: 'Thứ 6' },
  { value: 'T7', label: 'Thứ 7' },
  { value: 'CN', label: 'Chủ nhật' },
] as const

const WORK_SHIFTS = [
  'Ca sáng (06:00–12:00)',
  'Ca chiều (12:00–18:00)',
  'Ca tối (18:00–22:00)',
  'Ca đêm (22:00–06:00)',
  'Xoay ca linh hoạt',
] as const

function normalizePayNumber(rawNum: number, unit: PayUnit): number {
  if ((unit === 'K / giờ' || unit === 'K / ca') && rawNum >= 1000) {
    return Math.round(rawNum / 1000)
  }
  return rawNum
}

function parseJobPayInfo(job: Job): { min: number; max: number; unit: PayUnit } {
  const raw = (job.pay || '').trim()
  let unit: PayUnit = 'K / giờ'
  if (/triệu\s*\/\s*tháng|tr\s*\/\s*tháng/i.test(raw)) unit = 'Triệu / tháng'
  else if (/\/\s*ca/i.test(raw)) unit = 'K / ca'

  const matches = raw.match(/\d+(?:[.,]\d+)?/g) ?? []
  const nums = matches.map((n) => {
    const cleaned =
      unit !== 'Triệu / tháng' && /^\d{1,3}(?:[.,]\d{3})+$/.test(n)
        ? n.replace(/[.,]/g, '')
        : n.replace(',', '.')
    return normalizePayNumber(Number(cleaned), unit)
  })

  if (nums.length >= 2) {
    return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]), unit }
  }
  if (nums.length === 1) {
    return { min: nums[0], max: nums[0], unit }
  }
  const fallback = job.hourlyRate ? normalizePayNumber(job.hourlyRate, unit) : 0
  return { min: fallback, max: fallback, unit }
}

function parseTimeToMinutes(timeStr: string): number | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function extractJobTimeRange(schedule: string): { start: number; end: number } | null {
  const timeMatch = schedule.match(
    /(\d{1,2}[:h]\d{0,2})\s*(?:–|-|đến|tới)\s*(\d{1,2}[:h]\d{0,2})/i,
  )
  if (timeMatch) {
    const toMin = (str: string) => {
      const normalized = str.toLowerCase().replace('h', ':')
      const [hStr, mStr = '0'] = normalized.split(':')
      const h = Number(hStr)
      const m = Number(mStr)
      if (Number.isNaN(h) || Number.isNaN(m)) return null
      return h * 60 + m
    }
    const s = toMin(timeMatch[1])
    let e = toMin(timeMatch[2])
    if (s !== null && e !== null) {
      if (e <= s) e += 24 * 60
      return { start: s, end: e }
    }
  }

  const lower = schedule.toLowerCase()
  if (lower.includes('ca sáng') || lower.includes('buổi sáng')) return { start: 6 * 60, end: 12 * 60 }
  if (lower.includes('ca chiều') || lower.includes('buổi chiều')) return { start: 12 * 60, end: 18 * 60 }
  if (lower.includes('ca tối') || lower.includes('buổi tối')) return { start: 18 * 60, end: 22 * 60 }
  if (lower.includes('ca đêm')) return { start: 22 * 60, end: 30 * 60 }
  return null
}

function extractDaysFromSchedule(schedule: string): string[] {
  const s = schedule.toLowerCase()
  if (s.includes('t2–cn') || s.includes('t2-cn') || s.includes('cả tuần')) {
    return ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
  }
  if (s.includes('t2–t6') || s.includes('t2-t6')) {
    return ['T2', 'T3', 'T4', 'T5', 'T6']
  }
  if (s.includes('t2–t7') || s.includes('t2-t7')) {
    return ['T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  }
  if (s.includes('cuối tuần')) {
    return ['T7', 'CN']
  }
  const found: string[] = []
  const map: [RegExp, string][] = [
    [/\bt2\b|thứ\s*2/, 'T2'],
    [/\bt3\b|thứ\s*3/, 'T3'],
    [/\bt4\b|thứ\s*4/, 'T4'],
    [/\bt5\b|thứ\s*5/, 'T5'],
    [/\bt6\b|thứ\s*6/, 'T6'],
    [/\bt7\b|thứ\s*7/, 'T7'],
    [/\bcn\b|chủ\s*nhật/, 'CN'],
  ]
  for (const [regex, code] of map) {
    if (regex.test(s)) found.push(code)
  }
  return found
}

const PROVINCES_63 = [
  'An Giang',
  'Bà Rịa - Vũng Tàu',
  'Bắc Giang',
  'Bắc Kạn',
  'Bạc Liêu',
  'Bắc Ninh',
  'Bến Tre',
  'Bình Định',
  'Bình Dương',
  'Bình Phước',
  'Bình Thuận',
  'Cà Mau',
  'Cần Thơ',
  'Cao Bằng',
  'Đà Nẵng',
  'Đắk Lắk',
  'Đắk Nông',
  'Điện Biên',
  'Đồng Nai',
  'Đồng Tháp',
  'Gia Lai',
  'Hà Giang',
  'Hà Nam',
  'Hà Nội',
  'Hà Tĩnh',
  'Hải Dương',
  'Hải Phòng',
  'Hậu Giang',
  'Hòa Bình',
  'Huế',
  'Hưng Yên',
  'Khánh Hòa',
  'Kiên Giang',
  'Kon Tum',
  'Lai Châu',
  'Lâm Đồng',
  'Lạng Sơn',
  'Lào Cai',
  'Long An',
  'Nam Định',
  'Nghệ An',
  'Ninh Bình',
  'Ninh Thuận',
  'Phú Thọ',
  'Phú Yên',
  'Quảng Bình',
  'Quảng Nam',
  'Quảng Ngãi',
  'Quảng Ninh',
  'Quảng Trị',
  'Sóc Trăng',
  'Sơn La',
  'Tây Ninh',
  'Thái Bình',
  'Thái Nguyên',
  'Thanh Hóa',
  'Tiền Giang',
  'TP. Hồ Chí Minh',
  'Trà Vinh',
  'Tuyên Quang',
  'Vĩnh Long',
  'Vĩnh Phúc',
  'Yên Bái',
]

const locations = ['Tất cả tỉnh / thành phố', ...PROVINCES_63]

function openAttachmentInBrowser(fileUrl?: string, fallbackName = 'HoSo_UngVien') {
  if (!fileUrl) return
  try {
    if (fileUrl.startsWith('data:')) {
      const [header, base64Data] = fileUrl.split(',')
      const mimeMatch = header.match(/data:(.*?);base64/)
      const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf'
      const binary = atob(base64Data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: mimeType })
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank', 'noopener,noreferrer')
      return
    }
    window.open(fileUrl, '_blank', 'noopener,noreferrer')
  } catch {
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = fallbackName
    link.click()
  }
}

function isImageAttachment(fileName?: string, fileUrl?: string) {
  const lowerName = (fileName || '').toLowerCase()
  if (/\.(png|jpe?g|webp)$/i.test(lowerName)) return true
  return Boolean(fileUrl && /^data:image\/(png|jpeg|jpg|webp)/i.test(fileUrl))
}

function RatingStars({
  rating,
  onChange,
  size = 18,
}: {
  rating: number
  onChange: (value: number) => void
  size?: number
}) {
  return (
    <div
      className="rating-stars"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', margin: '6px 0' }}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star} sao`}
          onClick={() => onChange(star)}
          style={{
            width: '28px',
            height: '28px',
            minWidth: '28px',
            padding: 0,
            margin: 0,
            border: 'none',
            borderRadius: '6px',
            background: 'transparent',
            boxShadow: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Star
            size={size}
            fill={star <= rating ? '#f59e0b' : 'none'}
            color={star <= rating ? '#f59e0b' : '#9ca3af'}
          />
        </button>
      ))}
    </div>
  )
}

function Header({
  page,
  auth,
  go,
  logout,
  notifications,
  onSelectNotification,
  onMarkAllRead,
}: {
  page: Page
  auth: AuthRole
  go: (page: Page) => void
  logout: () => void
  notifications: NotificationRow[]
  onSelectNotification: (notif: NotificationRow) => Promise<void> | void
  onMarkAllRead: () => Promise<void> | void
}) {
  const [open, setOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifContainerRef = useRef<HTMLDivElement | null>(null)

  const employer = auth === 'employer'
  const admin = auth === 'admin'
  const guest = auth === 'guest'
  const authPage =
    page === 'signup' ||
    page === 'login' ||
    page === 'verify-email' ||
    page === 'forgot-password'

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notifContainerRef.current &&
        !notifContainerRef.current.contains(event.target as Node)
      ) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const links: [Page, string][] = admin
    ? [
        ['admin', 'Tổng quan'],
        ['admin-users', 'Người dùng'],
        ['admin-jobs', 'Kiểm duyệt việc'],
        ['admin-reviews', 'Đánh giá'],
      ]
    : employer
      ? [
          ['employer', 'Tổng quan'],
          ['post-job', 'Đăng việc'],
          ['candidates', 'Ứng viên'],
          ['profile', 'Hồ sơ'],
        ]
      : guest
        ? [['jobs', 'Tìm việc']]
        : [
            ['jobs', 'Tìm việc'],
            ['applications', 'Đơn ứng tuyển'],
            ['saved', 'Việc đã lưu'],
            ['profile', 'Hồ sơ'],
          ]
  return (
    <header
      className="site-header"
      style={{
        backgroundColor: '#114232',
        borderBottom: '1px solid rgba(255, 255, 255, 0.14)',
        color: '#ffffff',
      }}
    >
      <div className="header-inner">
        <button
          className="mobile-trigger"
          onClick={() => setOpen(!open)}
          style={{ color: '#ffffff' }}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <button
          className="wordmark"
          onClick={() => go(employer ? 'employer' : admin ? 'admin' : 'jobs')}
          style={{ color: '#ffffff' }}
        >
          <strong style={{ color: '#ffffff' }}>shiftly</strong>
          <span style={{ color: '#d7ee9b' }}>LÀM VIỆC, QUANH BẠN.</span>
        </button>
        {!authPage && (
          <nav className={open ? 'open' : ''}>
            {links.map(([id, label]) => {
              const isActive = page === id
              return (
                <button
                  key={`${id}-${label}`}
                  className={isActive ? 'active' : ''}
                  onClick={() => {
                    go(id)
                    setOpen(false)
                  }}
                  style={{
                    color: isActive ? '#114232' : '#e6eee9',
                    backgroundColor: isActive ? '#d7ee9b' : 'transparent',
                    borderRadius: '999px',
                    padding: '6px 14px',
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  {label}
                </button>
              )
            })}
          </nav>
        )}
        <div className="header-right">
          {guest ? (
            <>
              <button
                className="notification"
                onClick={() => go(page === 'login' ? 'jobs' : 'login')}
                style={{
                  backgroundColor: '#d7ee9b',
                  color: '#114232',
                  border: 'none',
                  fontWeight: 700,
                }}
              >
                {page === 'login' ? 'Tìm việc' : 'Đăng nhập'}
              </button>
            </>
          ) : admin ? (
            <button
              className="notification"
              onClick={logout}
              style={{
                backgroundColor: 'rgba(255,255,255,0.12)',
                color: '#ffffff',
                borderColor: 'rgba(255,255,255,0.25)',
              }}
            >
              Đăng xuất
            </button>
          ) : (
            <>
              <div ref={notifContainerRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="notification"
                  onClick={() => setNotifOpen((prev) => !prev)}
                  style={{
                    backgroundColor: unreadCount > 0 ? '#d7ee9b' : 'rgba(255,255,255,0.12)',
                    color: unreadCount > 0 ? '#114232' : '#ffffff',
                    borderColor: unreadCount > 0 ? '#d7ee9b' : 'rgba(255,255,255,0.25)',
                    fontWeight: unreadCount > 0 ? 700 : 600,
                  }}
                >
                  <Bell size={14} /> Thông báo · {unreadCount}
                </button>

                {notifOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 8px)',
                      width: 'min(380px, 92vw)',
                      background: '#ffffff',
                      border: '1px solid #d9e0dc',
                      borderRadius: '10px',
                      boxShadow: '0 14px 32px rgba(17, 66, 50, 0.14)',
                      zIndex: 50,
                      overflow: 'hidden',
                      color: '#141715',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderBottom: '1px solid #e7ece9',
                        background: '#f6f8f6',
                      }}
                    >
                      <strong style={{ fontSize: '14px', color: '#141715' }}>
                        Thông báo ({unreadCount} chưa đọc)
                      </strong>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          className="text-link"
                          style={{ padding: 0, fontSize: '12.5px' }}
                          onClick={() => void onMarkAllRead()}
                        >
                          Đánh dấu tất cả đã đọc
                        </button>
                      )}
                    </div>

                    <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                      {!notifications.length ? (
                        <div style={{ padding: '18px 14px', fontSize: '13.5px', color: '#5c6660' }}>
                          Chưa có thông báo nào.
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <button
                            key={notif.id}
                            type="button"
                            onClick={() => {
                              setNotifOpen(false)
                              void onSelectNotification(notif)
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '12px 14px',
                              border: 0,
                              borderBottom: '1px solid #eef2ef',
                              background: notif.read ? '#ffffff' : '#eff6f1',
                              cursor: 'pointer',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '4px',
                              }}
                            >
                              <strong
                                style={{
                                  fontSize: '13.5px',
                                  color: '#114232',
                                }}
                              >
                                {!notif.read && '● '}
                                {notif.title}
                              </strong>
                              <small style={{ color: '#6b7570', whiteSpace: 'nowrap' }}>
                                {notif.date}
                              </small>
                            </div>
                            <p
                              style={{
                                margin: 0,
                                fontSize: '13px',
                                color: '#3b433f',
                                lineHeight: 1.45,
                              }}
                            >
                              {notif.message}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                className="profile-link"
                onClick={logout}
                style={{ color: '#e6eee9', fontWeight: 600 }}
              >
                Đăng xuất
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function Hero({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string
  title: string
  copy: string
  action?: React.ReactNode
}) {
  return (
    <section
      className="hero workspace-hero"
      style={{
        backgroundColor: '#114232',
        color: '#ffffff',
        borderRadius: '14px',
        padding: '32px 36px',
        marginTop: '20px',
      }}
    >
      <div>
        <span style={{ color: '#d7ee9b', fontWeight: 700 }}>{eyebrow}</span>
        <h1 style={{ color: '#ffffff' }}>{title}</h1>
        <p style={{ color: '#d5e3dc' }}>{copy}</p>
      </div>
      {action}
    </section>
  )
}

function Filters({
  selectedCategories,
  setSelectedCategories,
  minPay,
  setMinPay,
  maxPay,
  setMaxPay,
  payUnit,
  setPayUnit,
  selectedDays,
  setSelectedDays,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  selectedShifts,
  setSelectedShifts,
  onResetAll,
}: {
  selectedCategories: string[]
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>
  minPay: string
  setMinPay: (v: string) => void
  maxPay: string
  setMaxPay: (v: string) => void
  payUnit: 'all' | PayUnit
  setPayUnit: (v: 'all' | PayUnit) => void
  selectedDays: string[]
  setSelectedDays: React.Dispatch<React.SetStateAction<string[]>>
  startTime: string
  setStartTime: (v: string) => void
  endTime: string
  setEndTime: (v: string) => void
  selectedShifts: string[]
  setSelectedShifts: React.Dispatch<React.SetStateAction<string[]>>
  onResetAll: () => void
}) {
  const toggleCategory = (item: string) => {
    if (item === 'Tất cả ngành nghề') {
      setSelectedCategories([])
      return
    }
    setSelectedCategories((prev) =>
      prev.includes(item) ? prev.filter((c) => c !== item) : [...prev, item],
    )
  }

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  const toggleShift = (shift: string) => {
    setSelectedShifts((prev) =>
      prev.includes(shift) ? prev.filter((s) => s !== shift) : [...prev, shift],
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    padding: '8px 10px',
    border: '1px solid #c9d4ce',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#141715',
    backgroundColor: '#ffffff',
    pointerEvents: 'auto',
    opacity: 1,
    boxSizing: 'border-box',
  }

  return (
    <aside className="filters" style={{ pointerEvents: 'auto' }}>
      <div className="filter-heading">
        <h2>Lọc việc làm</h2>
        <button type="button" onClick={onResetAll}>
          Đặt lại
        </button>
      </div>

      <div className="filter-section">
        <h3>Ngành nghề</h3>
        {jobCategories.map((item) => {
          const checked =
            item === 'Tất cả ngành nghề'
              ? selectedCategories.length === 0
              : selectedCategories.includes(item)
          return (
            <label key={item}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleCategory(item)}
              />
              <span className="fake-check">{checked && <Check size={10} />}</span>
              {item}
            </label>
          )
        })}
      </div>

      <div className="filter-section bordered">
        <h3>Mức lương mong muốn</h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {QUICK_PAY_PRESETS.map((preset) => {
            const active =
              minPay === preset.min && maxPay === preset.max && payUnit === preset.unit
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  if (active) {
                    setMinPay('')
                    setMaxPay('')
                    setPayUnit('all')
                  } else {
                    setMinPay(preset.min)
                    setMaxPay(preset.max)
                    setPayUnit(preset.unit)
                  }
                }}
                style={{
                  padding: '5px 9px',
                  borderRadius: '999px',
                  border: active ? '1px solid #114232' : '1px solid #d5ddd8',
                  backgroundColor: active ? '#114232' : '#f6f8f6',
                  color: active ? '#ffffff' : '#26312c',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '8px',
            marginBottom: '8px',
          }}
        >
          <div>
            <small style={{ display: 'block', color: '#5c6660', marginBottom: '4px' }}>
              Từ (mức tối thiểu)
            </small>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step="any"
              value={minPay}
              onChange={(e) => setMinPay(e.target.value)}
              placeholder="VD: 25"
              style={inputStyle}
            />
          </div>
          <div>
            <small style={{ display: 'block', color: '#5c6660', marginBottom: '4px' }}>
              Đến (mức tối đa)
            </small>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step="any"
              value={maxPay}
              onChange={(e) => setMaxPay(e.target.value)}
              placeholder="VD: 50"
              style={inputStyle}
            />
          </div>
        </div>

        <small style={{ display: 'block', color: '#5c6660', marginBottom: '4px' }}>
          Đơn vị lương
        </small>
        <select
          className="filter-select"
          style={inputStyle}
          value={payUnit}
          onChange={(e) => setPayUnit(e.target.value as 'all' | PayUnit)}
        >
          <option value="all">Tất cả đơn vị lương</option>
          {PAY_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-section bordered">
        <h3>Ngày rảnh trong tuần</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '6px',
          }}
        >
          {WORK_DAYS.map((d) => {
            const checked = selectedDays.includes(d.value)
            return (
              <button
                key={d.value}
                type="button"
                aria-pressed={checked}
                onClick={() => toggleDay(d.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '6px 4px',
                  borderRadius: '8px',
                  border: checked ? '1px solid #114232' : '1px solid #d5ddd8',
                  backgroundColor: checked ? '#eff6f1' : '#ffffff',
                  color: checked ? '#114232' : '#3b433f',
                  fontWeight: checked ? 700 : 500,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                {checked && <Check size={11} />}
                <span>{d.value}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="filter-section bordered">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            marginBottom: '8px',
          }}
        >
          <h3 style={{ margin: 0 }}>Khung giờ có thể làm</h3>
          {(startTime || endTime) && (
            <button
              type="button"
              onClick={() => {
                setStartTime('')
                setEndTime('')
              }}
              style={{
                border: 0,
                background: 'transparent',
                color: '#114232',
                fontSize: '11.5px',
                fontWeight: 600,
                padding: 0,
                cursor: 'pointer',
              }}
            >
              Xóa giờ
            </button>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '8px',
          }}
        >
          <div>
            <small style={{ display: 'block', color: '#5c6660', marginBottom: '4px' }}>
              Từ giờ
            </small>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <small style={{ display: 'block', color: '#5c6660', marginBottom: '4px' }}>
              Đến giờ
            </small>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      <div className="filter-section bordered">
        <h3>Ca làm việc có thể nhận</h3>
        {WORK_SHIFTS.map((shift) => {
          const checked = selectedShifts.includes(shift)
          return (
            <label key={shift}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleShift(shift)}
              />
              <span className="fake-check">{checked && <Check size={10} />}</span>
              {shift}
            </label>
          )
        })}
      </div>

      <p className="no-experience">
        <Check size={13} /> Phù hợp sinh viên, không cần kinh nghiệm
      </p>
    </aside>
  )
}

function FindJobs({
  jobs,
  go,
  selectJob,
  savedJobs,
  toggleSaved,
  canSave,
  auth,
  hasCV,
  cvName,
}: {
  jobs: Job[]
  go: (p: Page) => void
  selectJob: (j: Job) => void
  savedJobs: SavedJobRow[]
  toggleSaved: (jobId: string) => Promise<void>
  canSave: boolean
  auth: AuthRole
  hasCV: boolean
  cvName?: string
}) {
  const [draftQuery, setDraftQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [draftLocation, setDraftLocation] = useState('Tất cả tỉnh / thành phố')
  const [appliedLocation, setAppliedLocation] = useState('Tất cả tỉnh / thành phố')
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [minPay, setMinPay] = useState('')
  const [maxPay, setMaxPay] = useState('')
  const [payUnit, setPayUnit] = useState<'all' | PayUnit>('all')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [selectedShifts, setSelectedShifts] = useState<string[]>([])
  const [sortOrder, setSortOrder] = useState<'recommended' | 'newest' | 'oldest'>('recommended')
  const [currentPage, setCurrentPage] = useState(1)

  const searchBoxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setSearchHistory(parsed.filter((item) => typeof item === 'string').slice(0, 6))
      }
    } catch {
      // ignore storage errors
    }
  }, [])

  useEffect(() => {
    const handleOutsidePress = (event: MouseEvent | TouchEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleOutsidePress)
    document.addEventListener('touchstart', handleOutsidePress)
    return () => {
      document.removeEventListener('mousedown', handleOutsidePress)
      document.removeEventListener('touchstart', handleOutsidePress)
    }
  }, [])

  const saveHistoryKeyword = (rawKeyword: string) => {
    const clean = rawKeyword.trim()
    if (!clean) return
    setSearchHistory((prev) => {
      const next = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6)
      try {
        window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  const removeHistoryKeyword = (target: string) => {
    setSearchHistory((prev) => {
      const next = prev.filter((item) => item !== target)
      try {
        window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  const clearAllHistory = () => {
    setSearchHistory([])
    try {
      window.localStorage.removeItem(SEARCH_HISTORY_KEY)
    } catch {
      // ignore storage errors
    }
  }

  const executeSearch = (keyword: string, nextLocation = draftLocation) => {
    const clean = keyword.trim()
    setDraftQuery(clean)
    setAppliedQuery(clean)
    setDraftLocation(nextLocation)
    setAppliedLocation(nextLocation)
    setShowDropdown(false)
    setCurrentPage(1)
    if (clean) {
      saveHistoryKeyword(clean)
    }
  }

  const matchingHistory = useMemo(() => {
    const kw = draftQuery.trim().toLowerCase()
    if (!kw) return searchHistory
    return searchHistory.filter((item) => item.toLowerCase().includes(kw))
  }, [draftQuery, searchHistory])

  const suggestions = useMemo(() => {
    const kw = draftQuery.trim().toLowerCase()
    if (!kw) return []

    const items: Array<{ label: string; sub: string; keyword: string }> = []
    const seen = new Set<string>(searchHistory.map((h) => h.toLowerCase()))

    const addSuggestion = (label: string, sub: string, keyword: string) => {
      const key = label.toLowerCase()
      if (!seen.has(key) && (key.includes(kw) || keyword.toLowerCase().includes(kw))) {
        seen.add(key)
        items.push({ label, sub, keyword })
      }
    }

    for (const job of jobs) {
      addSuggestion(job.title, `${job.company} · ${job.pay}`, job.title)
      addSuggestion(job.company, `Doanh nghiệp · ${job.category}`, job.company)
      addSuggestion(job.category, 'Ngành nghề', job.category)
    }

    return items.slice(0, 6)
  }, [draftQuery, jobs, searchHistory])

  const matchesProvince = (place: string, selectedProvince: string) => {
    if (selectedProvince === 'Tất cả tỉnh / thành phố') return true

    const normalize = (str: string) =>
      str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/tp\.?\s*ho chi minh|tp\.?\s*hcm|tphcm|sai gon|thu duc/g, 'ho chi minh')
        .replace(/vung tau/g, 'ba ria - vung tau')
        .replace(/nha trang/g, 'khanh hoa')
        .replace(/da lat/g, 'lam dong')
        .replace(/bien hoa/g, 'dong nai')
        .replace(/thu dau mot|di an|thuan an/g, 'binh duong')
        .replace(/ha long/g, 'quang ninh')
        .replace(/buon ma thuot/g, 'dak lak')
        .replace(/pleiku/g, 'gia lai')
        .replace(/quy nhon/g, 'binh dinh')
        .replace(/long xuyen/g, 'an giang')
        .replace(/my tho/g, 'tien giang')
        .replace(/rach gia|phu quoc/g, 'kien giang')
        .replace(/tp\.?\s*/g, '')
        .replace(/thanh pho\s*/g, '')
        .replace(/tinh\s*/g, '')
        .trim()

    const target = normalize(selectedProvince)
    const normalizedPlace = normalize(place)
    const parts = place.split(',').map((part) => normalize(part))
    return (
      parts.some((p) => p === target || p.includes(target)) ||
      normalizedPlace.includes(target)
    )
  }

  const getPostedAgeMinutes = (job: Job) => {
    if (job.createdAt) {
      const ts = new Date(job.createdAt).getTime()
      if (!Number.isNaN(ts)) {
        return Math.max(0, Math.floor((Date.now() - ts) / 60000))
      }
    }

    const raw = (job.posted || '').trim().toLowerCase()
    if (!raw || raw.includes('vừa') || raw.includes('mới')) return 0
    if (raw.includes('hôm nay')) return 60
    if (raw.includes('hôm qua')) return 24 * 60

    const numMatch = raw.match(/(\d+)/)
    const num = numMatch ? Number(numMatch[1]) : 1

    if (raw.includes('phút')) return num
    if (raw.includes('giờ')) return num * 60
    if (raw.includes('ngày')) return num * 24 * 60
    if (raw.includes('tuần')) return num * 7 * 24 * 60
    if (raw.includes('tháng')) return num * 30 * 24 * 60
    if (raw.includes('năm')) return num * 365 * 24 * 60

    const dateMatch = raw.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
    if (dateMatch) {
      const day = Number(dateMatch[1])
      const month = Number(dateMatch[2]) - 1
      const year = dateMatch[3]
        ? Number(dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3])
        : new Date().getFullYear()
      const parsedDate = new Date(year, month, day).getTime()
      if (!Number.isNaN(parsedDate)) {
        return Math.max(0, Math.floor((Date.now() - parsedDate) / 60000))
      }
    }

    return 999999
  }

  const filtered = useMemo(() => {
    const minVal = minPay.trim() !== '' ? Number(minPay) : null
    const maxVal = maxPay.trim() !== '' ? Number(maxPay) : null
    const filterStartMin = startTime ? parseTimeToMinutes(startTime) : null
    const filterEndMin = endTime ? parseTimeToMinutes(endTime) : null

    const matched = jobs.filter((job) => {
      const text = `${job.title} ${job.company} ${job.category} ${job.place}`
        .toLowerCase()
        .includes(appliedQuery.trim().toLowerCase())
      const matchedCategory =
        selectedCategories.length === 0 || selectedCategories.includes(job.category)
      const area = matchesProvince(job.place, appliedLocation)

      const jobPay = parseJobPayInfo(job)
      const matchedUnit = payUnit === 'all' || jobPay.unit === payUnit
      const matchedMinPay =
        minVal === null ||
        Number.isNaN(minVal) ||
        jobPay.max >= normalizePayNumber(minVal, payUnit === 'all' ? jobPay.unit : payUnit)
      const matchedMaxPay =
        maxVal === null ||
        Number.isNaN(maxVal) ||
        jobPay.min <= normalizePayNumber(maxVal, payUnit === 'all' ? jobPay.unit : payUnit)

      const scheduleLower = (job.schedule || '').toLowerCase()
      const jobDays = extractDaysFromSchedule(job.schedule || '')
      const matchedDays =
        selectedDays.length === 0 ||
        scheduleLower.includes('linh hoạt') ||
        jobDays.length === 0 ||
        selectedDays.some((d) => jobDays.includes(d))

      let matchedTime = true
      if (filterStartMin !== null || filterEndMin !== null) {
        const range = extractJobTimeRange(job.schedule || '')
        if (range && !scheduleLower.includes('linh hoạt')) {
          const rangeStart = filterStartMin ?? 0
          const rangeEnd = filterEndMin ?? 24 * 60
          matchedTime = range.start <= rangeEnd && range.end >= rangeStart
        }
      }

      const matchedShifts =
        selectedShifts.length === 0 ||
        scheduleLower.includes('linh hoạt') ||
        selectedShifts.some((shift) => {
          const shortLabel = shift.split('(')[0].trim().toLowerCase()
          return scheduleLower.includes(shortLabel)
        })

      return (
        text &&
        matchedCategory &&
        area &&
        matchedUnit &&
        matchedMinPay &&
        matchedMaxPay &&
        matchedDays &&
        matchedTime &&
        matchedShifts
      )
    })

    if (sortOrder === 'recommended') return matched

    return [...matched].sort((a, b) => {
      const ageA = getPostedAgeMinutes(a)
      const ageB = getPostedAgeMinutes(b)
      return sortOrder === 'newest' ? ageA - ageB : ageB - ageA
    })
  }, [
    jobs,
    appliedQuery,
    selectedCategories,
    appliedLocation,
    minPay,
    maxPay,
    payUnit,
    selectedDays,
    startTime,
    endTime,
    selectedShifts,
    sortOrder,
  ])

  const totalPages = Math.max(1, Math.ceil(filtered.length / JOBS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * JOBS_PER_PAGE
  const paginatedJobs = filtered.slice(startIndex, startIndex + JOBS_PER_PAGE)

  const handlePageChange = (nextPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, nextPage))
    setCurrentPage(clamped)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasDropdownContent =
    matchingHistory.length > 0 || suggestions.length > 0 || draftQuery.trim().length > 0

  return (
    <main>
      <Hero
        eyebrow="TÌM CƠ HỘI TIẾP THEO CỦA BẠN"
        title="Tìm công việc phù hợp với lịch học."
        copy="Khám phá việc làm bán thời gian đa ngành nghề trên khắp 63 tỉnh thành Việt Nam."
      />
      <section className="search-bar" style={{ position: 'relative' }}>
        <div
          ref={searchBoxRef}
          style={{
            position: 'relative',
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <label style={{ width: '100%' }}>
            <span>Vị trí hoặc từ khóa</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                value={draftQuery}
                onFocus={() => setShowDropdown(true)}
                onClick={() => setShowDropdown(true)}
                onChange={(e) => {
                  const val = e.target.value
                  setDraftQuery(val)
                  setShowDropdown(true)
                  if (!val.trim()) {
                    setAppliedQuery('')
                    setCurrentPage(1)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowDropdown(false)
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    executeSearch(draftQuery, draftLocation)
                  }
                }}
                placeholder="Pha chế, Gia sư, Bán hàng, Marketing, Sự kiện..."
              />
              {draftQuery && (
                <button
                  type="button"
                  aria-label="Xóa từ khóa đang nhập"
                  onClick={() => {
                    setDraftQuery('')
                    setAppliedQuery('')
                    setShowDropdown(true)
                    setCurrentPage(1)
                  }}
                  style={{
                    border: 0,
                    background: '#eef2ef',
                    color: '#5b6962',
                    borderRadius: '999px',
                    width: '22px',
                    height: '22px',
                    fontSize: '12px',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </label>

          {showDropdown && hasDropdownContent && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 12px)',
                left: '-10px',
                right: '-10px',
                zIndex: 40,
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #dfe5e1',
                boxShadow: '0 14px 32px rgba(17, 66, 50, 0.14)',
                overflow: 'hidden',
              }}
            >
              {matchingHistory.length > 0 && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 14px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      color: '#6b7972',
                      backgroundColor: '#f6f8f6',
                      borderBottom: '1px solid #e7ebe8',
                    }}
                  >
                    <span>LỊCH SỬ TÌM KIẾM GẦN ĐÂY</span>
                    <button
                      type="button"
                      onClick={clearAllHistory}
                      style={{
                        border: 0,
                        background: 'transparent',
                        color: '#185f43',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      Xóa lịch sử
                    </button>
                  </div>

                  {matchingHistory.map((item) => (
                    <div
                      key={item}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #eef1ef',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => executeSearch(item, draftLocation)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 14px',
                          border: 0,
                          background: 'transparent',
                          textAlign: 'left',
                          color: '#173a2e',
                          fontSize: '13.5px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        <Clock size={14} color="#6b7972" />
                        <span>{item}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Xóa ${item}`}
                        onClick={() => removeHistoryKeyword(item)}
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: '#8c9691',
                          padding: '8px 14px',
                          fontSize: '14px',
                          cursor: 'pointer',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {draftQuery.trim().length > 0 && (
                <div>
                  <div
                    style={{
                      padding: '8px 14px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      color: '#6b7972',
                      backgroundColor: '#f6f8f6',
                      borderBottom: '1px solid #e7ebe8',
                    }}
                  >
                    ĐỀ XUẤT TÌM KIẾM LIÊN QUAN
                  </div>

                  {suggestions.length > 0 ? (
                    suggestions.map((item, idx) => (
                      <button
                        key={`${item.label}-${idx}`}
                        type="button"
                        onClick={() => executeSearch(item.keyword, draftLocation)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          padding: '10px 14px',
                          border: 0,
                          borderBottom: idx < suggestions.length - 1 ? '1px solid #eef1ef' : 'none',
                          backgroundColor: '#ffffff',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#173a2e' }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7972', marginTop: '2px' }}>
                            {item.sub}
                          </div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#185f43' }}>
                          Tìm kiếm ↵
                        </span>
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      onClick={() => executeSearch(draftQuery, draftLocation)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        border: 0,
                        backgroundColor: '#ffffff',
                        textAlign: 'left',
                        fontSize: '13px',
                        color: '#5b6962',
                        cursor: 'pointer',
                      }}
                    >
                      Nhấn <strong>Tìm việc</strong> để tìm &ldquo;{draftQuery.trim()}&rdquo;
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <label className="location-field">
          <span>Tỉnh / Thành phố</span>
          <select
            value={draftLocation}
            onChange={(e) => {
              setDraftLocation(e.target.value)
            }}
          >
            {locations.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => executeSearch(draftQuery, draftLocation)}>
          <Search size={15} /> Tìm việc
        </button>
      </section>
      <section className="market-grid">
        <Filters
          selectedCategories={selectedCategories}
          setSelectedCategories={(updater) => {
            setSelectedCategories(updater)
            setCurrentPage(1)
          }}
          minPay={minPay}
          setMinPay={(v) => {
            setMinPay(v)
            setCurrentPage(1)
          }}
          maxPay={maxPay}
          setMaxPay={(v) => {
            setMaxPay(v)
            setCurrentPage(1)
          }}
          payUnit={payUnit}
          setPayUnit={(v) => {
            setPayUnit(v)
            setCurrentPage(1)
          }}
          selectedDays={selectedDays}
          setSelectedDays={(updater) => {
            setSelectedDays(updater)
            setCurrentPage(1)
          }}
          startTime={startTime}
          setStartTime={(v) => {
            setStartTime(v)
            setCurrentPage(1)
          }}
          endTime={endTime}
          setEndTime={(v) => {
            setEndTime(v)
            setCurrentPage(1)
          }}
          selectedShifts={selectedShifts}
          setSelectedShifts={(updater) => {
            setSelectedShifts(updater)
            setCurrentPage(1)
          }}
          onResetAll={() => {
            setDraftQuery('')
            setAppliedQuery('')
            setDraftLocation('Tất cả tỉnh / thành phố')
            setAppliedLocation('Tất cả tỉnh / thành phố')
            setShowDropdown(false)
            setSelectedCategories([])
            setMinPay('')
            setMaxPay('')
            setPayUnit('all')
            setSelectedDays([])
            setStartTime('')
            setEndTime('')
            setSelectedShifts([])
            setSortOrder('recommended')
            setCurrentPage(1)
          }}
        />
        <div className="job-results">
          <div className="results-heading">
            <h2>
              {appliedQuery
                ? `${filtered.length} kết quả cho "${appliedQuery}"`
                : `${filtered.length} việc làm`}
              {appliedLocation !== 'Tất cả tỉnh / thành phố'
                ? ` tại ${appliedLocation}`
                : !appliedQuery
                  ? ' trên toàn quốc'
                  : ''}
            </h2>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13.5px',
                color: '#4c5953',
                cursor: 'pointer',
              }}
            >
              <span>Sắp xếp:</span>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value as 'recommended' | 'newest' | 'oldest')
                  setCurrentPage(1)
                }}
                style={{
                  border: '1px solid #d5ddd8',
                  borderRadius: '8px',
                  padding: '5px 10px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  color: '#114232',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <option value="recommended">Đề xuất</option>
                <option value="newest">Mới nhất</option>
                <option value="oldest">Lâu hơn</option>
              </select>
            </label>
          </div>
          <div className="job-list">
            {paginatedJobs.map((job) => {
              const isSaved = savedJobs.some((saved) => saved.jobId === job.id)
              return (
                <article className="job-card" key={job.id}>
                  <div className="job-topline">
                    <span>{job.company}</span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <strong>{job.pay}</strong>
                      {canSave && (
                        <button
                          type="button"
                          aria-label={isSaved ? 'Bỏ lưu công việc' : 'Lưu công việc'}
                          onClick={(e) => {
                            e.stopPropagation()
                            void toggleSaved(job.id)
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: 600,
                            lineHeight: 1.2,
                            cursor: 'pointer',
                            border: isSaved ? '1px solid #114232' : '1px solid #d1dbd5',
                            background: isSaved ? '#114232' : '#f4f7f5',
                            color: isSaved ? '#ffffff' : '#114232',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Bookmark size={12} fill={isSaved ? 'currentColor' : 'none'} />
                          <span>{isSaved ? 'Đã lưu' : 'Lưu'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <h3>{job.title}</h3>
                  <p>
                    {job.place} · {job.schedule}
                  </p>
                  <div className="job-bottomline">
                    <span className="job-category">{job.category}</span>
                    <small>{job.posted}</small>
                    <button
                      onClick={() => {
                        selectJob(job)
                        go('detail')
                      }}
                    >
                      Xem việc <ArrowRight size={13} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          {!filtered.length && (
            <div className="empty-result">
              Không tìm thấy công việc phù hợp với bộ lọc hiện tại.
            </div>
          )}
          {filtered.length > 0 && totalPages > 1 && (
            <nav aria-label="Phân trang công việc" className="pagination-bar">
              <button
                type="button"
                disabled={safeCurrentPage === 1}
                onClick={() => handlePageChange(safeCurrentPage - 1)}
              >
                ← Trước
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
                const isActive = pageNum === safeCurrentPage
                return (
                  <button
                    key={pageNum}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </button>
                )
              })}

              <button
                type="button"
                disabled={safeCurrentPage === totalPages}
                onClick={() => handlePageChange(safeCurrentPage + 1)}
              >
                Sau →
              </button>
            </nav>
          )}
        </div>
        <aside className="right-rail">
          <div className="profile-promo">
            {auth === 'student' && !hasCV ? (
              <>
                <span>
                  HỒ SƠ ỨNG TUYỂN.
                  <br />
                  SẴN SÀNG NGAY.
                </span>
                <h2>
                  Bạn chưa có CV.
                  <br />
                  Hãy tạo ngay.
                </h2>
                <p>
                  Cập nhật thông tin cá nhân và tải lên CV (PDF, JPG, PNG) để ứng tuyển nhanh chỉ
                  với một lần chạm.
                </p>
                <button onClick={() => go('profile')}>
                  Tạo CV ngay <ArrowRight size={14} />
                </button>
              </>
            ) : auth === 'student' && hasCV ? (
              <>
                <span>
                  HỒ SƠ ĐÃ SẴN SÀNG.
                  <br />
                  ỨNG TUYỂN NHANH.
                </span>
                <h2>
                  CV của bạn
                  <br />
                  đã được lưu.
                </h2>
                <p>
                  Tệp hiện tại: <strong>{cvName || 'Hồ sơ sinh viên'}</strong>. Bạn có thể chọn
                  việc làm phù hợp và nộp đơn ngay.
                </p>
                <button onClick={() => go('profile')}>
                  Cập nhật hồ sơ <ArrowRight size={14} />
                </button>
              </>
            ) : (
              <>
                <span>
                  CA LÀM NHỎ.
                  <br />
                  CƠ HỘI LỚN.
                </span>
                <h2>
                  Lịch của bạn.
                  <br />
                  Trải nghiệm của bạn.
                </h2>
                <p>
                  Đa dạng ngành nghề từ dịch vụ, giáo dục đến truyền thông, sự kiện — linh hoạt theo
                  buổi học.
                </p>
                <button onClick={() => go('login')}>
                  Ứng tuyển <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
          <div className="steps-card">
            <h2>Một khởi đầu tốt hơn</h2>
            {[
              ['01', 'Ứng tuyển tự tin', 'Thêm CV hoặc ảnh hồ sơ và lời giới thiệu ngắn.'],
              ['02', 'Luôn được cập nhật', 'Nhận thông báo khi có phản hồi.'],
              ['03', 'Xây dựng uy tín', 'Nhận đánh giá sau mỗi công việc.'],
            ].map(([n, t, c]) => (
              <div className="step" key={n}>
                <strong>{n}</strong>
                <div>
                  <h3>{t}</h3>
                  <p>{c}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  )
}

function ProfilePage({
  auth,
  profile,
  onSaveProfile,
  go,
  returnToPage,
}: {
  auth: AuthRole
  profile: UserProfileData
  onSaveProfile: (updated: UserProfileData) => Promise<void>
  go: (p: Page) => void
  returnToPage?: Page | null
}) {
  const isEmployer = auth === 'employer'
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone)
  const [bio, setBio] = useState(profile.bio)
  const [defaultCvName, setDefaultCvName] = useState(profile.defaultCvName)
  const [defaultCvUrl, setDefaultCvUrl] = useState(profile.defaultCvUrl)

  const [companyName, setCompanyName] = useState(profile.companyName || profile.name)
  const [companyArea, setCompanyArea] = useState(
    profile.companyArea && PROVINCES_63.includes(profile.companyArea)
      ? profile.companyArea
      : 'TP. Hồ Chí Minh',
  )
  const [companyAddress, setCompanyAddress] = useState(profile.companyAddress)
  const [companyDescription, setCompanyDescription] = useState(profile.companyDescription)

  const [saving, setSaving] = useState(false)
  const [savedBanner, setSavedBanner] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setName(profile.name)
    setPhone(profile.phone)
    setBio(profile.bio)
    setDefaultCvName(profile.defaultCvName)
    setDefaultCvUrl(profile.defaultCvUrl)
    setCompanyName(profile.companyName || profile.name)
    setCompanyArea(
      profile.companyArea && PROVINCES_63.includes(profile.companyArea)
        ? profile.companyArea
        : 'TP. Hồ Chí Minh',
    )
    setCompanyAddress(profile.companyAddress)
    setCompanyDescription(profile.companyDescription)
  }, [profile.email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const updatedPayload: UserProfileData = {
        ...profile,
        name: isEmployer ? companyName.trim() || name.trim() : name.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        defaultCvName,
        defaultCvUrl,
        companyName: companyName.trim(),
        companyArea,
        companyAddress: companyAddress.trim(),
        companyDescription: companyDescription.trim(),
        isProfileCompleted: true,
      }
      const res = await updateProfileAction(updatedPayload)
      if (!res.ok || !res.data) {
        setError(res.ok ? 'Không thể lưu hồ sơ.' : res.error)
        setSaving(false)
        return
      }
      await onSaveProfile(res.data)
      setSaving(false)
      setSavedBanner('Đã lưu hồ sơ thành công!')
      if (returnToPage) {
        window.setTimeout(() => go(returnToPage), 500)
      } else {
        window.setTimeout(() => setSavedBanner(''), 2500)
      }
    } catch {
      setSaving(false)
      setError('Có lỗi xảy ra khi lưu hồ sơ.')
    }
  }

  return (
    <main>
      <Hero
        eyebrow={isEmployer ? 'HỒ SƠ NHÀ TUYỂN DỤNG' : 'HỒ SƠ SINH VIÊN'}
        title={isEmployer ? 'Thông tin đơn vị tuyển dụng.' : 'Hồ sơ cá nhân của bạn.'}
        copy={
          isEmployer
            ? 'Cập nhật thông tin doanh nghiệp / cửa hàng và tỉnh thành làm việc để tự động điền khi đăng tin.'
            : 'Cập nhật thông tin cá nhân, lời giới thiệu và CV / ảnh hồ sơ để ứng tuyển nhanh chóng.'
        }
      />
      {savedBanner && (
        <div className="admin-notice">
          <Check size={14} />
          {savedBanner}
        </div>
      )}
      <div className="post-grid">
        <form className="white-card post-form" onSubmit={handleSubmit}>
          <h2>{isEmployer ? 'Chỉnh sửa hồ sơ đơn vị' : 'Cập nhật hồ sơ sinh viên'}</h2>
          <p>
            {returnToPage === 'detail'
              ? 'Sau khi lưu hồ sơ, bạn sẽ quay lại trang xem công việc để nộp đơn.'
              : 'Các thay đổi sẽ được lưu và áp dụng ngay cho tài khoản của bạn.'}
          </p>

          <div className="form-grid">
            {isEmployer ? (
              <>
                <label className="wide">
                  Tên doanh nghiệp / Cửa hàng
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ví dụ: The Coffee House - Chi nhánh Hoàn Kiếm"
                    required
                  />
                </label>
                <label>
                  Người phụ trách / Liên hệ
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Họ và tên người quản lý"
                    required
                  />
                </label>
                <label>
                  Số điện thoại
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ví dụ: 0909 123 456"
                  />
                </label>
                <label>
                  Tỉnh / Thành phố mặc định
                  <select value={companyArea} onChange={(e) => setCompanyArea(e.target.value)}>
                    {PROVINCES_63.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Địa chỉ mặc định
                  <input
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="Ví dụ: 86 Cao Thắng, Quận 1"
                  />
                </label>
                <label className="full">
                  Giới thiệu về đơn vị tuyển dụng
                  <textarea
                    value={companyDescription}
                    onChange={(e) => setCompanyDescription(e.target.value)}
                    placeholder="Mô tả môi trường làm việc, chế độ ca làm cho sinh viên..."
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Họ và tên
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nhập họ và tên của bạn"
                    required
                  />
                </label>
                <label>
                  Số điện thoại
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ví dụ: 0901 234 567"
                    required
                  />
                </label>
                <label className="full">
                  Giới thiệu bản thân
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Giới thiệu thế mạnh, kỹ năng và các buổi bạn có thể đi làm..."
                    required
                  />
                </label>
                <label className="full">
                  CV hoặc ảnh hồ sơ mặc định (PDF, JPG, PNG · Tối đa 1.5 MB)
                  <div className="file-box">
                    <div>
                      <strong>{defaultCvName || 'Chưa có hồ sơ mặc định'}</strong>
                      <small>Hỗ trợ PDF, JPG, PNG · Dùng nhanh khi nộp đơn ứng tuyển</small>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 'none' }}>
                      {defaultCvUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            openAttachmentInBrowser(
                              defaultCvUrl,
                              defaultCvName || 'HoSo_SinhVien',
                            )
                          }
                        >
                          Xem tệp
                        </button>
                      )}
                      <label
                        className="file-upload-button cursor-pointer text-emerald-800"
                        style={{ margin: 0, fontWeight: 600, fontSize: '13.5px' }}
                      >
                        Tải tệp mới
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                          style={{
                            position: 'absolute',
                            width: '1px',
                            height: '1px',
                            opacity: 0,
                            overflow: 'hidden',
                          }}
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (!file) return
                            if (file.size > MAX_ATTACHMENT_BYTES) {
                              setError(
                                'Tệp/ảnh vượt quá 1.5 MB. Vui lòng chọn tệp có dung lượng nhỏ hơn để lưu hồ sơ thành công.',
                              )
                              event.target.value = ''
                              return
                            }
                            setError('')
                            const reader = new FileReader()
                            reader.onload = () => {
                              if (typeof reader.result === 'string') {
                                setDefaultCvName(file.name)
                                setDefaultCvUrl(reader.result)
                              }
                            }
                            reader.readAsDataURL(file)
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </label>
              </>
            )}
          </div>

          <div className="form-actions">
            <span>Thông tin được đồng bộ ngay cho tài khoản hiện tại.</span>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
          </div>
          {error && <div className="login-error">{error}</div>}
        </form>

        <aside>
          <div className="white-card live-preview">
            <span>TÓM TẮT HỒ SƠ</span>
            <small>{isEmployer ? 'Nhà tuyển dụng' : 'Sinh viên'}</small>
            <h2>{isEmployer ? companyName || name : name || 'Chưa có tên'}</h2>
            <strong>{phone || 'Chưa cập nhật SĐT'}</strong>
            {isEmployer ? (
              <>
                <p>Tỉnh / Thành phố: {companyArea}</p>
                <p>{companyAddress || 'Chưa cập nhật địa chỉ chi tiết'}</p>
                <p>{companyDescription || 'Chưa có mô tả đơn vị.'}</p>
              </>
            ) : (
              <>
                <p>{bio || 'Chưa có lời giới thiệu bản thân.'}</p>
                <p>Hồ sơ đính kèm: {defaultCvName || 'Chưa chọn tệp'}</p>
              </>
            )}
            <hr />
            <span className="status recruiting">Đã sẵn sàng sử dụng</span>
          </div>
        </aside>
      </div>
      <button
        className="text-link"
        onClick={() => go(returnToPage || (isEmployer ? 'employer' : 'jobs'))}
      >
        {returnToPage === 'detail'
          ? '← Quay lại xem công việc'
          : isEmployer
            ? '← Quay lại tổng quan nhà tuyển dụng'
            : '← Quay lại tìm việc'}
      </button>
    </main>
  )
}

function JobDetail({
  job,
  application,
  auth,
  userName,
  profileCompleted,
  defaultCv,
  defaultIntro,
  go,
  onRequestUpdateProfile,
  setApplications,
  setEmployerJobs,
  onStudentReviewSubmitted,
}: {
  job: Job
  application?: ApplicationRow | null
  auth: AuthRole
  userName: string
  profileCompleted: boolean
  defaultCv?: { name: string; url: string } | null
  defaultIntro?: string
  go: (p: Page) => void
  onRequestUpdateProfile: () => void
  setApplications: React.Dispatch<React.SetStateAction<ApplicationRow[]>>
  setEmployerJobs: React.Dispatch<React.SetStateAction<EmployerJobRow[]>>
  onStudentReviewSubmitted: () => Promise<void> | void
}) {
  const [sent, setSent] = useState(false)
  const [introduction, setIntroduction] = useState(defaultIntro ?? '')
  const [actionError, setActionError] = useState('')
  const [cv, setCV] = useState<{ id: string; name: string; url: string } | null>(
    defaultCv ? { id: 'default-cv', name: defaultCv.name, url: defaultCv.url } : null,
  )

  useEffect(() => {
    if (!application) {
      setIntroduction(defaultIntro ?? '')
    }
  }, [defaultIntro, application])

  useEffect(() => {
    if (!application) {
      setCV(defaultCv ? { id: 'default-cv', name: defaultCv.name, url: defaultCv.url } : null)
    }
  }, [defaultCv, application])

  const [studentRating, setStudentRating] = useState(application?.studentReview?.rating ?? 5)
  const [studentComment, setStudentComment] = useState(application?.studentReview?.comment ?? '')
  const [studentReviewSent, setStudentReviewSent] = useState(Boolean(application?.studentReview))
  const [studentReviewError, setStudentReviewError] = useState('')

  useEffect(() => {
    setStudentRating(application?.studentReview?.rating ?? 5)
    setStudentComment(application?.studentReview?.comment ?? '')
    setStudentReviewSent(Boolean(application?.studentReview))
    setStudentReviewError('')
  }, [application?.id, application?.studentReview])

  const hasEmployerEvaluation = Boolean(application?.employerReview)

  return (
    <main>
      <Hero
        eyebrow={
          application
            ? 'ĐƠN ỨNG TUYỂN / CHI TIẾT & ĐÁNH GIÁ'
            : 'TÌM VIỆC / CHI TIẾT CÔNG VIỆC'
        }
        title={
          hasEmployerEvaluation
            ? 'Kết quả & nhận xét từ nhà tuyển dụng.'
            : 'Một ca làm tốt. Một bước tiến mới.'
        }
        copy={
          hasEmployerEvaluation
            ? 'Xem lại nhận xét từ nhà tuyển dụng và gửi đánh giá của bạn bên dưới.'
            : 'Tìm hiểu vị trí và gửi đơn ứng tuyển chỉ trong vài phút.'
        }
      />
      <div className="detail-grid">
        <div className="detail-left">
          <section className="white-card job-overview">
            <div>
              <small>
                {job.company} · {job.category}
              </small>
              <h2>{job.title}</h2>
              <p>{job.place} · Ca làm linh hoạt</p>
              <span
                className={`status ${
                  application?.status === 'completed'
                    ? 'completed'
                    : application?.status === 'hired'
                      ? 'hired'
                      : 'recruiting'
                }`}
              >
                {application?.status === 'completed'
                  ? 'Đã hoàn thành'
                  : application?.status === 'hired'
                    ? 'Đã nhận việc'
                    : 'Đang tuyển'}
              </span>
            </div>
            <div className="overview-pay">
              <strong>{job.pay}</strong>
              <span>Nhiều vị trí</span>
              <small>{job.posted}</small>
            </div>
          </section>
          <section className="white-card description-card">
            <h2>Mô tả công việc</h2>
            <p>{job.description}</p>
            <h3>Quyền lợi dành cho sinh viên</h3>
            <ul>
              <li>Chủ động đăng ký ca làm việc phù hợp với thời khóa biểu tại trường</li>
              <li>Được hướng dẫn, đào tạo quy trình công việc ngay từ buổi đầu</li>
              <li>Môi trường làm việc năng động, thân thiện và tích lũy kinh nghiệm thực tế</li>
            </ul>
            <h3>Phù hợp nếu bạn...</h3>
            <p>
              Là sinh viên các trường Đại học / Cao đẳng, có tinh thần trách nhiệm, giao tiếp tốt và
              đảm bảo được thời gian đăng ký hàng tuần.
            </p>
            <hr />
            <h3>{job.company}</h3>
            <small>4.8 / 5 · 24 đánh giá sinh viên · Đơn vị tuyển dụng uy tín</small>
          </section>
          <button className="text-link" onClick={() => go(application ? 'applications' : 'jobs')}>
            {application ? '← Quay lại đơn ứng tuyển của tôi' : '← Quay lại tất cả việc làm'}
          </button>
        </div>
        {auth === 'guest' ? (
          <section className="white-card application-form guest-apply-card">
            <span className="section-kicker">CƠ HỘI DÀNH CHO BẠN</span>
            <h2>Sẵn sàng ứng tuyển?</h2>
            <p>Đăng nhập để gửi hồ sơ cho nhà tuyển dụng.</p>
            <hr />
            <h3>{job.title}</h3>
            <p>{job.company}</p>
            <div className="guest-shift-summary">
              <div>
                <span>MỨC LƯƠNG</span>
                <strong>{job.pay}</strong>
              </div>
              <div>
                <span>THỜI GIAN</span>
                <strong>{job.schedule}</strong>
              </div>
              <div>
                <span>ĐỊA ĐIỂM</span>
                <strong>{job.place}</strong>
              </div>
            </div>
            <button className="primary-wide" onClick={() => go('login')}>
              Ứng tuyển <ArrowRight size={14} />
            </button>
            <small>Bạn sẽ được chuyển đến trang đăng nhập để tiếp tục.</small>
          </section>
        ) : application && application.employerReview ? (
          <section className="white-card application-form">
            <span className="section-kicker">KẾT QUẢ & NHẬN XÉT TỪ NHÀ TUYỂN DỤNG</span>
            <h2>Đánh giá từ {application.employerReview.reviewerName}</h2>
            <p>
              Vị trí: {application.title} · Ngày nộp: {application.date}
            </p>
            <hr />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                margin: '0.75rem 0',
              }}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={18}
                  fill={star <= application.employerReview!.rating ? '#f59e0b' : 'none'}
                  color={star <= application.employerReview!.rating ? '#f59e0b' : '#9ca3af'}
                />
              ))}
              <strong>{application.employerReview.rating} / 5 sao</strong>
            </div>
            <label>Nhận xét chi tiết từ nhà tuyển dụng</label>
            <div
              className="file-box"
              style={{ display: 'block', lineHeight: 1.6, marginTop: '0.5rem' }}
            >
              <p style={{ margin: 0 }}>
                {application.employerReview.comment ||
                  'Nhà tuyển dụng đã xác nhận hoàn thành tốt công việc.'}
              </p>
              <small style={{ display: 'block', marginTop: '0.5rem' }}>
                Cập nhật: {application.employerReview.date}
              </small>
            </div>

            <hr />

            <span className="section-kicker">ĐÁNH GIÁ NHÀ TUYỂN DỤNG</span>
            <h3>Trải nghiệm làm việc của bạn tại {application.company}</h3>
            {studentReviewSent || application.studentReview ? (
              <div
                className="file-box"
                style={{ display: 'block', lineHeight: 1.6, marginTop: '0.5rem' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    marginBottom: '0.4rem',
                  }}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={16}
                      fill={
                        star <= (application.studentReview?.rating ?? studentRating)
                          ? '#f59e0b'
                          : 'none'
                      }
                      color={
                        star <= (application.studentReview?.rating ?? studentRating)
                          ? '#f59e0b'
                          : '#9ca3af'
                      }
                    />
                  ))}
                  <strong>
                    {application.studentReview?.rating ?? studentRating} / 5 sao
                  </strong>
                </div>
                <p style={{ margin: 0 }}>
                  {application.studentReview?.comment || studentComment || 'Cảm ơn cơ hội làm việc!'}
                </p>
                <small style={{ display: 'block', marginTop: '0.4rem', color: '#047857' }}>
                  {application.studentReview?.moderationStatus === 'approved'
                    ? '✓ Đã được quản trị viên duyệt và hiển thị cho nhà tuyển dụng'
                    : '⏳ Đã gửi đánh giá — đang chờ quản trị viên duyệt hiển thị'}
                </small>
              </div>
            ) : (
              <>
                <RatingStars rating={studentRating} onChange={setStudentRating} size={18} />
                <textarea
                  value={studentComment}
                  onChange={(e) => setStudentComment(e.target.value)}
                  placeholder="Chia sẻ nhận xét của bạn về môi trường làm việc, mức độ hỗ trợ từ nhà tuyển dụng..."
                />
                {studentReviewError && <div className="login-error">{studentReviewError}</div>}
                <button
                  className="primary-wide"
                  style={{ marginTop: '0.75rem' }}
                  onClick={async () => {
                    const result = await createReviewAction({
                      applicationId: application.id,
                      rating: studentRating,
                      comment: studentComment,
                    })
                    if (!result.ok) {
                      setStudentReviewError(result.error)
                      return
                    }
                    const studentReviewPayload: ReviewData = {
                      id: result.data?.reviewId,
                      rating: studentRating,
                      comment: studentComment,
                      date: 'Hôm nay',
                      reviewerName: application.studentName || userName || 'Sinh viên',
                      moderationStatus: 'pending',
                    }
                    setApplications((current) =>
                      current.map((item) =>
                        item.id === application.id
                          ? { ...item, studentReview: studentReviewPayload }
                          : item,
                      ),
                    )
                    setStudentReviewSent(true)
                    setStudentReviewError('')
                    await onStudentReviewSubmitted()
                  }}
                >
                  Gửi đánh giá nhà tuyển dụng ({studentRating} sao)
                </button>
              </>
            )}

            <button
              className="text-link"
              style={{ marginTop: '1rem', display: 'block' }}
              onClick={() => go('applications')}
            >
              ← Quay lại danh sách đơn ứng tuyển
            </button>
          </section>
        ) : application ? (
          <section className="white-card application-form">
            <span className="section-kicker">THÔNG TIN ĐƠN ĐÃ NỘP</span>
            <h2>Hồ sơ ứng tuyển của bạn</h2>
            <p>
              Ứng viên: {application.studentName} · Ngày nộp: {application.date}
            </p>
            <hr />
            <span className="section-kicker">TRẠNG THÁI HIỆN TẠI</span>
            <h3>
              {
                {
                  pending: 'Đang chờ nhà tuyển dụng xem xét',
                  hired: 'Đã được nhận việc',
                  rejected: 'Chưa phù hợp ở đợt này',
                  completed: 'Đã hoàn thành công việc (Đang chờ nhà tuyển dụng đánh giá)',
                }[application.status]
              }
            </h3>
            <label>Tệp đính kèm (CV / Ảnh)</label>
            <div className="file-box" style={{ marginBottom: '0.5rem' }}>
              <div>
                <strong>
                  {application.hasCV
                    ? application.cvName || `HoSo_${application.studentName}`
                    : 'Không đính kèm tệp'}
                </strong>
              </div>
              {application.hasCV && application.cvUrl && (
                <button
                  type="button"
                  onClick={() =>
                    openAttachmentInBrowser(
                      application.cvUrl,
                      application.cvName || `HoSo_${application.studentName}`,
                    )
                  }
                >
                  <Eye size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  Xem tệp
                </button>
              )}
            </div>
            <label>Lời giới thiệu bạn đã gửi</label>
            <div className="file-box" style={{ display: 'block' }}>
              <p style={{ margin: 0 }}>
                {application.introduction || 'Không có lời giới thiệu đính kèm.'}
              </p>
            </div>
            <button
              className="primary-wide"
              style={{ marginTop: '1rem' }}
              onClick={() => go('applications')}
            >
              Quay lại đơn ứng tuyển
            </button>
          </section>
        ) : auth === 'student' && !profileCompleted ? (
          <section className="white-card application-form guest-apply-card">
            <span className="section-kicker">CHƯA CÓ HỒ SƠ SINH VIÊN</span>
            <h2>Bạn chưa có hồ sơ.</h2>
            <p>
              Tài khoản của bạn chưa cập nhật thông tin hồ sơ sinh viên. Hãy tạo/cập nhật hồ sơ
              trước khi nộp đơn cho công việc này.
            </p>
            <hr />
            <h3>{job.title}</h3>
            <p>{job.company}</p>
            <div className="guest-shift-summary">
              <div>
                <span>MỨC LƯƠNG</span>
                <strong>{job.pay}</strong>
              </div>
              <div>
                <span>THỜI GIAN</span>
                <strong>{job.schedule}</strong>
              </div>
              <div>
                <span>ĐỊA ĐIỂM</span>
                <strong>{job.place}</strong>
              </div>
            </div>
            <button className="primary-wide" onClick={onRequestUpdateProfile}>
              Tạo / Cập nhật hồ sơ ngay <ArrowRight size={14} />
            </button>
            <small>Sau khi lưu hồ sơ, bạn sẽ quay lại công việc này để ứng tuyển.</small>
          </section>
        ) : (
          <section className="white-card application-form">
            <h2>Giới thiệu bản thân</h2>
            <p>Ứng tuyển với tên {userName || 'của bạn'}</p>
            <hr />
            <span className="section-kicker">CA LÀM</span>
            <h3>{job.schedule}</h3>
            <p>Linh hoạt theo lịch học · Bắt đầu ngay</p>
            <label>CV hoặc ảnh hồ sơ của bạn (PDF, JPG, PNG · Tối đa 1.5 MB)</label>
            <div className="file-box">
              <div>
                <strong>{cv?.name ?? 'Chưa đính kèm tệp'}</strong>
                <small>
                  {cv ? 'Đã chọn tệp sẵn sàng nộp (PDF, JPG, PNG)' : 'PDF, JPG, PNG · Tối đa 1.5 MB'}
                </small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 'none' }}>
                {cv?.url && (
                  <button type="button" onClick={() => openAttachmentInBrowser(cv.url, cv.name)}>
                    Xem trước
                  </button>
                )}
                <label
                  className="file-upload-button cursor-pointer text-emerald-800"
                  style={{ margin: 0, fontWeight: 600, fontSize: '13.5px' }}
                >
                  {cv ? 'Thay thế' : 'Tải tệp'}
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    style={{
                      position: 'absolute',
                      width: '1px',
                      height: '1px',
                      opacity: 0,
                      overflow: 'hidden',
                    }}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      if (file.size > MAX_ATTACHMENT_BYTES) {
                        setActionError(
                          'Tệp/ảnh vượt quá 1.5 MB. Vui lòng chọn tệp nhẹ hơn để gửi hồ sơ.',
                        )
                        event.target.value = ''
                        return
                      }
                      const reader = new FileReader()
                      reader.onload = () => {
                        const resultUrl =
                          typeof reader.result === 'string' ? reader.result : ''
                        setCV({
                          id: `cv-${Date.now()}`,
                          name: file.name,
                          url: resultUrl,
                        })
                        setActionError('')
                      }
                      reader.onerror = () => {
                        setActionError('Không thể đọc tệp đính kèm. Vui lòng thử lại.')
                      }
                      reader.readAsDataURL(file)
                    }}
                  />
                </label>
              </div>
            </div>
            <label>Giới thiệu ngắn</label>
            <textarea
              value={introduction}
              onChange={(event) => setIntroduction(event.target.value)}
              placeholder="Giới thiệu thế mạnh, kỹ năng và các buổi bạn có thể đi làm..."
            />
            <p className="availability">
              <Check size={13} /> Tôi có thể làm trong các khung giờ đã nêu.
            </p>
            <button
              className="primary-wide"
              onClick={async () => {
                const result = await applyToJobAction({
                  jobId: job.id,
                  title: job.title,
                  company: job.company,
                  pay: job.pay,
                  place: job.place,
                  schedule: job.schedule,
                  introduction,
                  cvId: cv?.id,
                  cvName: cv?.name,
                  cvUrl: cv?.url,
                })
                if (!result.ok) {
                  setActionError(result.error)
                  return
                }

                setApplications((currentApps) => [
                  {
                    id: `app-${Date.now()}`,
                    jobId: job.id,
                    title: job.title,
                    company: job.company,
                    date: 'Hôm nay',
                    status: 'pending',
                    studentName: userName || 'Sinh viên',
                    studentSchool: 'Sinh viên ứng tuyển',
                    introduction: introduction,
                    pay: job.pay,
                    place: job.place,
                    schedule: job.schedule,
                    openings: 1,
                    hasCV: Boolean(cv?.id || cv?.name),
                    cvName: cv?.name,
                    cvUrl: cv?.url,
                  },
                  ...currentApps,
                ])

                setEmployerJobs((currentJobs) =>
                  currentJobs.map((item) =>
                    item.id === job.id
                      ? { ...item, applicationCount: (item.applicationCount || 0) + 1 }
                      : item,
                  ),
                )

                setSent(true)
                setActionError('')
                window.setTimeout(() => go('applications'), 700)
              }}
            >
              {sent ? 'Đã gửi đơn' : 'Gửi đơn ứng tuyển'} {sent && <Check size={14} />}
            </button>
            {actionError && <div className="login-error">{actionError}</div>}
            <small>Thông tin liên hệ của bạn sẽ được chia sẻ với nhà tuyển dụng.</small>
          </section>
        )}
      </div>
    </main>
  )
}

function Applications({
  go,
  applications,
  notifications,
  onMarkNotificationRead,
  onViewApplication,
}: {
  go: (p: Page) => void
  applications: ApplicationRow[]
  notifications: NotificationRow[]
  onMarkNotificationRead: (id: string) => Promise<void> | void
  onViewApplication: (application: ApplicationRow) => void
}) {
  const [reviewed, setReviewed] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const completed = applications.find((application) => application.status === 'completed')
  return (
    <main>
      <Hero
        eyebrow="ĐƠN ỨNG TUYỂN CỦA TÔI"
        title="Mọi bước tiếp theo, trong một nơi."
        copy="Theo dõi đơn ứng tuyển, chuẩn bị cho ca làm và chia sẻ trải nghiệm."
      />
      <StatGrid
        items={[
          ['Đơn ứng tuyển', String(applications.length), ''],
          [
            'Đang chờ phản hồi',
            String(applications.filter((item) => item.status === 'pending').length),
            '',
          ],
          [
            'Công việc sắp tới',
            String(applications.filter((item) => item.status === 'hired').length),
            '',
          ],
          [
            'Đã hoàn thành',
            String(applications.filter((item) => item.status === 'completed').length),
            '',
          ],
        ]}
      />
      <div className="dashboard-grid student-dashboard">
        <section className="white-card table-card">
          <div className="card-heading">
            <h2>Đơn ứng tuyển của bạn</h2>
            <button>Tất cả đơn</button>
          </div>
          <div className="table-head">
            <span>VIỆC / NHÀ TUYỂN DỤNG</span>
            <span>NGÀY NỘP</span>
            <span>TRẠNG THÁI</span>
            <span>THAO TÁC</span>
          </div>
          {applications.map((application) => {
            const statusLabel = {
              pending: 'Đang xem xét',
              hired: 'Đã nhận',
              rejected: 'Chưa chọn',
              completed: application.employerReview ? 'Đã đánh giá' : 'Hoàn thành',
            }[application.status]
            const statusClass = {
              pending: 'review',
              hired: 'hired',
              rejected: 'declined',
              completed: 'completed',
            }[application.status]
            return (
              <div className="table-row" key={application.id}>
                <div>
                  <strong>{application.title}</strong>
                  <small>{application.company}</small>
                </div>
                <span>{application.date}</span>
                <span className={`status ${statusClass}`}>{statusLabel}</span>
                <button
                  onClick={() => {
                    onViewApplication(application)
                    go('detail')
                  }}
                >
                  {application.employerReview ? 'Xem nhận xét' : 'Xem'}
                </button>
              </div>
            )
          })}
          {!applications.length && (
            <div className="empty-result">Bạn chưa có đơn ứng tuyển nào.</div>
          )}
        </section>
        <section className="white-card updates-card">
          <div className="card-heading">
            <h2>Cập nhật mới nhất</h2>
            <span>{notifications.filter((item) => !item.read).length} chưa đọc</span>
          </div>
          {notifications.map((notification) => (
            <div
              className={notification.read ? 'next-shift' : 'update-highlight'}
              key={notification.id}
            >
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                <small>{notification.date}</small>
              </div>
              {!notification.read && (
                <button onClick={() => void onMarkNotificationRead(notification.id)}>
                  Đã đọc
                </button>
              )}
            </div>
          ))}
          {!notifications.length && <div className="empty-result">Bạn chưa có thông báo mới.</div>}
        </section>
        <section className="white-card review-card">
          <h2>Ca làm của bạn thế nào?</h2>
          {completed ? (
            <>
              <p>
                {completed.company} · {completed.title}
              </p>
              <RatingStars rating={reviewRating} onChange={setReviewRating} size={18} />
              <div className="review-action">
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  placeholder="Chia sẻ trải nghiệm của bạn..."
                />
                <button
                  disabled={reviewed}
                  onClick={async () => {
                    const result = await createReviewAction({
                      applicationId: completed.id,
                      rating: reviewRating,
                      comment: reviewComment,
                    })
                    if (!result.ok) {
                      setReviewError(result.error)
                      return
                    }
                    setReviewed(true)
                    setReviewError('')
                  }}
                >
                  {reviewed ? 'Đã đăng đánh giá' : 'Đăng đánh giá'}
                </button>
              </div>
              {reviewError && <div className="login-error">{reviewError}</div>}
            </>
          ) : (
            <div className="empty-result">
              Bạn có thể đánh giá nhà tuyển dụng sau khi hoàn thành công việc.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function StatGrid({ items }: { items: string[][] }) {
  return (
    <div className="figma-stats">
      {items.map(([label, value, copy]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          {copy && <small>{copy}</small>}
        </div>
      ))}
    </div>
  )
}

function EmployerDashboard({
  go,
  jobs,
  applications,
  userName,
  onToggleJobStatus,
}: {
  go: (p: Page) => void
  jobs: EmployerJobRow[]
  applications: ApplicationRow[]
  userName: string
  onToggleJobStatus: (jobId: string, nextStatus: 'recruiting' | 'paused') => Promise<void>
}) {
  const [expandedReviewJobId, setExpandedReviewJobId] = useState<string | null>(null)
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null)
  const [jobStatusFilter, setJobStatusFilter] = useState<
    'all' | 'recruiting' | 'filled' | 'completed' | 'paused'
  >('all')

  const activeJobs = jobs.filter((job) => job.status === 'recruiting')
  const filledJobs = jobs.filter((job) => job.status === 'filled')
  const completedJobs = jobs.filter((job) => job.status === 'completed')
  const pausedJobs = jobs.filter((job) => job.status === 'paused')
  const hired = applications.filter((application) => application.status === 'hired')
  const approvedStudentReviews = applications.filter(
    (application) => application.studentReview?.moderationStatus === 'approved',
  )

  const displayedJobs = useMemo(() => {
    if (jobStatusFilter === 'all') return jobs
    return jobs.filter((job) => job.status === jobStatusFilter)
  }, [jobs, jobStatusFilter])

  return (
    <main>
      <Hero
        eyebrow="KHÔNG GIAN NHÀ TUYỂN DỤNG"
        title={`Chào bạn, ${userName || 'nhà tuyển dụng'}.`}
        copy="Theo dõi toàn bộ trạng thái công việc từ lúc đang tuyển, đã nhận người đến khi hoàn thành."
        action={
          <button className="hero-action" onClick={() => go('post-job')}>
            + Đăng việc
          </button>
        }
      />
      <StatGrid
        items={[
          ['Đang tuyển', String(activeJobs.length), 'Tin đang mở nhận hồ sơ'],
          ['Đã nhận người', String(filledJobs.length), `${hired.length} ứng viên đã duyệt`],
          ['Đã hoàn thành', String(completedJobs.length), 'Ca làm đã kết thúc'],
          [
            'Đánh giá từ sinh viên',
            String(approvedStudentReviews.length),
            'Đã kiểm duyệt & hiển thị',
          ],
        ]}
      />
      <div className="employer-layout">
        <section className="white-card table-card">
          <div className="card-heading">
            <h2>Theo dõi trạng thái công việc</h2>
            <button onClick={() => go('post-job')}>+ Đăng việc mới</button>
          </div>

          <div
            className="candidate-filters"
            style={{ marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}
          >
            <button
              type="button"
              className={jobStatusFilter === 'all' ? 'active' : ''}
              onClick={() => setJobStatusFilter('all')}
            >
              Tất cả · {jobs.length}
            </button>
            <button
              type="button"
              className={jobStatusFilter === 'recruiting' ? 'active' : ''}
              onClick={() => setJobStatusFilter('recruiting')}
            >
              Đang tuyển · {activeJobs.length}
            </button>
            <button
              type="button"
              className={jobStatusFilter === 'filled' ? 'active' : ''}
              onClick={() => setJobStatusFilter('filled')}
            >
              Đã nhận người · {filledJobs.length}
            </button>
            <button
              type="button"
              className={jobStatusFilter === 'completed' ? 'active' : ''}
              onClick={() => setJobStatusFilter('completed')}
            >
              Hoàn thành · {completedJobs.length}
            </button>
            {pausedJobs.length > 0 && (
              <button
                type="button"
                className={jobStatusFilter === 'paused' ? 'active' : ''}
                onClick={() => setJobStatusFilter('paused')}
              >
                Dừng tuyển · {pausedJobs.length}
              </button>
            )}
          </div>

          <div className="table-head employer-table">
            <span>VIỆC</span>
            <span>ỨNG VIÊN</span>
            <span>TRẠNG THÁI</span>
            <span>BƯỚC TIẾP</span>
          </div>
          {displayedJobs.map((job) => {
            const hiredStudent = applications.find(
              (a) => a.jobId === job.id && (a.status === 'hired' || a.status === 'completed'),
            )
            return (
              <div className="table-row employer-table" key={job.id}>
                <div>
                  <strong>{job.title}</strong>
                  <small>
                    {job.schedule} · {job.place}
                    {hiredStudent && ` · Nhân sự: ${hiredStudent.studentName}`}
                  </small>
                </div>
                <span>{job.applicationCount}</span>
                <span
                  className={`status ${
                    job.status === 'paused'
                      ? 'declined'
                      : job.status === 'filled'
                        ? 'hired'
                        : job.status
                  }`}
                >
                  {job.moderationStatus === 'pending'
                    ? 'Chờ duyệt'
                    : job.moderationStatus === 'rejected'
                      ? 'Bị từ chối'
                      : job.status === 'recruiting'
                        ? 'Đang tuyển'
                        : job.status === 'paused'
                          ? 'Dừng tuyển'
                          : job.status === 'filled'
                            ? 'Đã nhận người'
                            : 'Hoàn thành'}
                </span>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {job.moderationStatus === 'approved' &&
                    (job.status === 'recruiting' || job.status === 'paused') && (
                      <button
                        type="button"
                        disabled={updatingJobId === job.id}
                        onClick={async () => {
                          setUpdatingJobId(job.id)
                          await onToggleJobStatus(
                            job.id,
                            job.status === 'recruiting' ? 'paused' : 'recruiting',
                          )
                          setUpdatingJobId(null)
                        }}
                      >
                        {updatingJobId === job.id
                          ? 'Đang xử lý...'
                          : job.status === 'recruiting'
                            ? 'Dừng tuyển'
                            : 'Mở lại'}
                      </button>
                    )}
                  <button type="button" onClick={() => go('candidates')}>
                    {job.status === 'filled' ? 'Cập nhật hoàn thành' : 'Xem ứng viên'}
                  </button>
                </div>
              </div>
            )
          })}
          {!displayedJobs.length && (
            <div className="empty-result">
              {jobs.length
                ? 'Không có công việc nào ở trạng thái này.'
                : 'Bạn chưa đăng việc nào. Hãy tạo tin đầu tiên để bắt đầu tuyển dụng.'}
            </div>
          )}
        </section>
        <aside className="dark-promo">
          <span>
            ỨNG VIÊN TỐT,
            <br />
            NGAY QUANH BẠN.
          </span>
          <h2>
            Nhân sự tiếp theo
            <br />
            đang ở đây.
          </h2>
          <p>
            {applications.length
              ? `${applications.length} hồ sơ đang chờ bạn xem xét.`
              : 'Ứng viên phù hợp sẽ xuất hiện tại đây khi họ nộp hồ sơ.'}
          </p>
          <button onClick={() => go('candidates')}>
            Xem đơn ứng tuyển <ArrowRight size={14} />
          </button>
        </aside>
        <section className="white-card review-card">
          <h2>Đánh giá từ sinh viên</h2>
          {!approvedStudentReviews.length ? (
            <div className="empty-result">
              Đánh giá từ sinh viên sẽ hiển thị tại đây sau khi được quản trị viên duyệt.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {approvedStudentReviews.map((app) => {
                const matchedJob = jobs.find((j) => j.id === app.jobId)
                const isExpanded = expandedReviewJobId === app.id
                return (
                  <div
                    key={app.id}
                    className="file-box"
                    style={{ display: 'block', lineHeight: 1.5 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <strong>{app.studentReview!.reviewerName}</strong>
                      <span>
                        {'★'.repeat(app.studentReview!.rating)}
                        {'☆'.repeat(5 - app.studentReview!.rating)} ({app.studentReview!.rating}/5)
                      </span>
                    </div>

                    <div style={{ margin: '0.35rem 0' }}>
                      <button
                        type="button"
                        className="text-link"
                        style={{
                          padding: 0,
                          fontSize: '0.88rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                        onClick={() => setExpandedReviewJobId(isExpanded ? null : app.id)}
                      >
                        <Eye size={14} />
                        {isExpanded
                          ? 'Ẩn chi tiết công việc'
                          : `Xem chi tiết công việc: ${app.title}`}
                      </button>
                    </div>

                    {isExpanded && (
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '0.65rem 0.85rem',
                          marginBottom: '0.5rem',
                          fontSize: '0.9rem',
                        }}
                      >
                        <div>
                          <strong>Vị trí:</strong> {matchedJob?.title || app.title}
                        </div>
                        <div>
                          <strong>Mức lương:</strong> {matchedJob?.pay || app.pay} ·{' '}
                          <strong>Lịch làm:</strong> {matchedJob?.schedule || app.schedule}
                        </div>
                        <div>
                          <strong>Địa điểm:</strong> {matchedJob?.place || app.place} ·{' '}
                          <strong>Ngành nghề:</strong> {matchedJob?.category || 'Đa ngành nghề'}
                        </div>
                        {matchedJob?.description && (
                          <div style={{ marginTop: '0.25rem' }}>
                            <strong>Mô tả:</strong> {matchedJob.description}
                          </div>
                        )}
                      </div>
                    )}

                    <small style={{ display: 'block', marginBottom: '0.25rem' }}>
                      Ngày đánh giá: {app.studentReview!.date}
                    </small>
                    <p style={{ margin: 0 }}>{app.studentReview!.comment}</p>
                  </div>
                )
              })}
            </div>
          )}
        </section>
        <aside className="white-card latest-card">
          <h2>Cập nhật mới nhất</h2>
          <h3>{applications.length} đơn ứng tuyển</h3>
          <p>
            {applications.length
              ? 'Mở danh sách ứng viên để duyệt tuyển, đánh dấu hoàn thành và đánh giá.'
              : 'Chưa có đơn ứng tuyển cho các tin của bạn.'}
          </p>
          <button onClick={() => go('candidates')}>Xem tất cả ứng viên →</button>
        </aside>
      </div>
    </main>
  )
}

function PostJob({
  go,
  companyName,
  defaultLocation,
  defaultAddress,
  onJobCreated,
}: {
  go: (p: Page) => void
  companyName: string
  defaultLocation?: string
  defaultAddress?: string
  onJobCreated: () => Promise<unknown> | void
}) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('F&B / Phục vụ')
  const [location, setLocation] = useState(
    defaultLocation && PROVINCES_63.includes(defaultLocation)
      ? defaultLocation
      : 'TP. Hồ Chí Minh',
  )
  const [streetAddress, setStreetAddress] = useState(defaultAddress || '')
  const [minPay, setMinPay] = useState('')
  const [maxPay, setMaxPay] = useState('')
  const [payUnit, setPayUnit] = useState<PayUnit>('K / giờ')
  const [workDays, setWorkDays] = useState<string[]>(['T2', 'T3', 'T4', 'T5', 'T6'])
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('12:00')
  const [shifts, setShifts] = useState<string[]>(['Ca sáng (06:00–12:00)'])
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const toggleWorkDay = (day: string) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  const toggleShift = (shift: string) => {
    setShifts((prev) =>
      prev.includes(shift) ? prev.filter((s) => s !== shift) : [...prev, shift],
    )
  }

  const resetForm = () => {
    setTitle('')
    setCategory('F&B / Phục vụ')
    setLocation(
      defaultLocation && PROVINCES_63.includes(defaultLocation)
        ? defaultLocation
        : 'TP. Hồ Chí Minh',
    )
    setStreetAddress(defaultAddress || '')
    setMinPay('')
    setMaxPay('')
    setPayUnit('K / giờ')
    setWorkDays(['T2', 'T3', 'T4', 'T5', 'T6'])
    setStartTime('08:00')
    setEndTime('12:00')
    setShifts(['Ca sáng (06:00–12:00)'])
    setDescription('')
    setRequirements('')
  }

  const previewPlace = streetAddress.trim()
    ? `${streetAddress.trim()}, ${location}`
    : location

  const previewPay = useMemo(() => {
    const min = Number(minPay)
    const max = Number(maxPay)
    const suffix = payUnit.startsWith('K') ? payUnit : ` ${payUnit}`
    if (min > 0 && max > 0 && min !== max) return `${min}–${max}${suffix}`
    if (min > 0) return `${min}${suffix}`
    if (max > 0) return `${max}${suffix}`
    return 'Mức lương theo thỏa thuận'
  }, [minPay, maxPay, payUnit])

  const previewSchedule = useMemo(() => {
    const parts: string[] = []
    if (workDays.length > 0) {
      parts.push(workDays.length === 7 ? 'T2–CN' : workDays.join(', '))
    }
    if (startTime && endTime) {
      parts.push(`${startTime}–${endTime}`)
    }
    if (shifts.length > 0) {
      parts.push(shifts.map((s) => s.split('(')[0].trim()).join(', '))
    }
    return parts.length > 0 ? parts.join(' · ') : 'Lịch làm việc linh hoạt'
  }, [workDays, startTime, endTime, shifts])

  return (
    <main>
      <Hero
        eyebrow="CÔNG VIỆC / ĐĂNG VIỆC"
        title="Tìm nhân sự phù hợp tiếp theo."
        copy="Mô tả rõ ràng giúp bạn nhận được những ứng viên sinh viên phù hợp hơn."
      />
      <div className="post-grid">
        <form
          className="white-card post-form"
          onSubmit={async (event) => {
            event.preventDefault()
            const minVal = Number(minPay)
            const maxVal = maxPay.trim() ? Number(maxPay) : minVal
            if (!minVal || minVal <= 0) {
              setError('Vui lòng nhập mức lương tối thiểu hợp lệ.')
              return
            }
            if (maxVal < minVal) {
              setError('Lương tối đa phải lớn hơn hoặc bằng lương tối thiểu.')
              return
            }
            if (workDays.length === 0) {
              setError('Vui lòng chọn ít nhất 1 ngày làm việc.')
              return
            }
            if (shifts.length === 0) {
              setError('Vui lòng chọn ít nhất 1 ca làm việc.')
              return
            }

            setSubmitting(true)
            const result = await createJobAction({
              title,
              companyName,
              category,
              location,
              streetAddress,
              hourlyMin: minVal,
              hourlyMax: maxVal,
              payUnit,
              workDays,
              startTime,
              endTime,
              shifts: shifts.map((s) => s.split('(')[0].trim()),
              schedule: previewSchedule,
              description,
              requirements,
              openings: 1,
            })
            setSubmitting(false)
            if (!result.ok) {
              setError(result.error)
              setStatusMessage('')
              return
            }
            setError('')
            setStatusMessage(
              'Đăng việc thành công! Tin tuyển dụng đã được gửi sang hệ thống và đang đợi Admin duyệt.',
            )
            resetForm()
            await onJobCreated()
          }}
        >
          <h2>Chi tiết công việc</h2>
          <p>Điền đầy đủ thông tin để sinh viên dễ nắm bắt ca làm và mức lương.</p>

          {statusMessage && (
            <div className="admin-notice">
              <Check size={14} />
              {statusMessage}
            </div>
          )}

          <div className="form-grid">
            <label>
              Tên công việc
              <input
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Nhân viên Pha chế, Trợ giảng..."
                required
              />
            </label>

            <label>
              Ngành nghề
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {jobCategories.slice(1).map((cat) => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>
            </label>

            <label>
              Lương tối thiểu
              <input
                type="number"
                min={1}
                step="any"
                value={minPay}
                onChange={(e) => setMinPay(e.target.value)}
                placeholder="Ví dụ: 30"
                required
              />
            </label>

            <label>
              Lương tối đa
              <input
                type="number"
                min={1}
                step="any"
                value={maxPay}
                onChange={(e) => setMaxPay(e.target.value)}
                placeholder="Ví dụ: 45"
                required
              />
            </label>

            <label>
              Đơn vị lương
              <select
                value={payUnit}
                onChange={(e) => setPayUnit(e.target.value as PayUnit)}
              >
                {PAY_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tỉnh / Thành phố
              <select
                name="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                {PROVINCES_63.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </label>

            <label className="full">
              Địa chỉ cụ thể (Số nhà, đường, phường/xã, quận/huyện)
              <input
                name="streetAddress"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="Ví dụ: 86 Cao Thắng, Phường 4, Quận 3"
                required
              />
            </label>

            <label>
              Giờ bắt đầu
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </label>

            <label>
              Giờ kết thúc
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </label>

            <div className="full post-option-group">
              <span className="post-group-label">Ngày làm việc trong tuần (Chọn nhiều)</span>
              <div className="post-days-row">
                {WORK_DAYS.map((day) => {
                  const checked = workDays.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleWorkDay(day.value)}
                      className={`post-chip-btn ${checked ? 'is-active' : ''}`}
                    >
                      {checked && <Check size={13} />}
                      <span>{day.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="full post-option-group">
              <span className="post-group-label">Ca làm việc có thể nhận (Chọn nhiều)</span>
              <div className="post-shifts-grid">
                {WORK_SHIFTS.map((shift) => {
                  const checked = shifts.includes(shift)
                  return (
                    <button
                      key={shift}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleShift(shift)}
                      className={`post-shift-btn ${checked ? 'is-active' : ''}`}
                    >
                      <span className="post-shift-box">
                        {checked && <Check size={12} />}
                      </span>
                      <span className="post-shift-text">{shift}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="full">
              Mô tả công việc
              <textarea
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả nhiệm vụ chính, ca làm và môi trường làm việc..."
                required
              />
            </label>

            <label className="full">
              Yêu cầu ứng viên
              <input
                name="requirements"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="Ví dụ: Sinh viên chăm chỉ, giao tiếp tốt, có thể làm ít nhất 3 buổi/tuần"
                required
              />
            </label>
          </div>

          <div className="form-actions">
            <span>Sau khi đăng, tin sẽ chuyển sang trạng thái chờ Admin duyệt.</span>
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? 'Đang đăng...' : 'Đăng việc'}
            </button>
          </div>
          {error && <div className="login-error">{error}</div>}
        </form>

        <aside className="post-aside">
          <div className="white-card live-preview">
            <span>XEM TRƯỚC TIN ĐĂNG</span>
            <small>{companyName || 'Đơn vị tuyển dụng'}</small>
            <h2>{title || 'Tên công việc'}</h2>
            <strong>{previewPay}</strong>
            <p>
              {category} · {previewPlace}
            </p>
            <p>{previewSchedule}</p>
            <hr />
            <span className="status review">Chờ Admin duyệt</span>
          </div>

          <div className="posting-tip">
            <h2>Một tin rõ ràng tạo khác biệt.</h2>
            <p>01 Minh bạch về mức lương tối thiểu, tối đa và đơn vị trả lương.</p>
            <p>02 Nêu chính xác các ngày làm việc, khung giờ và ca tuyển dụng.</p>
            <p>03 Cho sinh viên biết rõ công việc cụ thể sẽ làm.</p>
          </div>
        </aside>
      </div>

      <button className="text-link" onClick={() => go('employer')}>
        ← Quay lại tổng quan nhà tuyển dụng
      </button>
    </main>
  )
}

function Candidates({
  applications,
  setApplications,
  setEmployerJobs,
  employerName,
  onActionCompleted,
}: {
  applications: ApplicationRow[]
  setApplications: React.Dispatch<React.SetStateAction<ApplicationRow[]>>
  setEmployerJobs: React.Dispatch<React.SetStateAction<EmployerJobRow[]>>
  employerName: string
  onActionCompleted: () => Promise<void> | void
}) {
  const [selected, setSelected] = useState(0)
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'hired' | 'rejected' | 'completed'
  >('all')
  const [decision, setDecision] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [previewPdfOpen, setPreviewPdfOpen] = useState(false)
  const [candidates, setCandidates] = useState(applications)

  useEffect(() => {
    setCandidates(applications)
  }, [applications])

  const filteredCandidates = useMemo(() => {
    if (statusFilter === 'all') return candidates
    return candidates.filter((item) => item.status === statusFilter)
  }, [candidates, statusFilter])

  const person = filteredCandidates[selected] ?? filteredCandidates[0]

  useEffect(() => {
    setPreviewPdfOpen(false)
  }, [person?.id])

  const syncJobStatus = (jobId: string, nextStatus: 'recruiting' | 'filled' | 'completed') => {
    setEmployerJobs((currentJobs) =>
      currentJobs.map((job) => (job.id === jobId ? { ...job, status: nextStatus } : job)),
    )
  }

  const updateBothStates = (
    appId: string,
    nextStatus: 'pending' | 'hired' | 'rejected' | 'completed',
  ) => {
    setCandidates((current) =>
      current.map((item) => (item.id === appId ? { ...item, status: nextStatus } : item)),
    )
    setApplications((current) =>
      current.map((item) => (item.id === appId ? { ...item, status: nextStatus } : item)),
    )
  }

  if (!candidates.length) {
    return (
      <main>
        <Hero
          eyebrow="ỨNG VIÊN"
          title="Gặp gỡ thành viên tiếp theo."
          copy="Các đơn ứng tuyển mới sẽ xuất hiện tại đây."
        />
        <div className="empty-result">Chưa có ứng viên nào cho các tin tuyển dụng của bạn.</div>
      </main>
    )
  }

  return (
    <main>
      <Hero
        eyebrow="ỨNG VIÊN & ĐÁNH GIÁ"
        title="Quản lý tuyển dụng, hoàn thành và đánh giá."
        copy={
          person
            ? `Xem đơn ứng tuyển cho vị trí ${person.title} tại ${person.company}.`
            : 'Chọn một bộ lọc trạng thái để xem danh sách ứng viên.'
        }
      />
      <div className="candidate-filters">
        <button
          className={statusFilter === 'all' ? 'active' : ''}
          onClick={() => {
            setStatusFilter('all')
            setSelected(0)
            setDecision('')
          }}
        >
          Tất cả · {candidates.length}
        </button>
        <button
          className={statusFilter === 'pending' ? 'active' : ''}
          onClick={() => {
            setStatusFilter('pending')
            setSelected(0)
            setDecision('')
          }}
        >
          Mới · {candidates.filter((item) => item.status === 'pending').length}
        </button>
        <button
          className={statusFilter === 'hired' ? 'active' : ''}
          onClick={() => {
            setStatusFilter('hired')
            setSelected(0)
            setDecision('')
          }}
        >
          Đã nhận · {candidates.filter((item) => item.status === 'hired').length}
        </button>
        <button
          className={statusFilter === 'completed' ? 'active' : ''}
          onClick={() => {
            setStatusFilter('completed')
            setSelected(0)
            setDecision('')
          }}
        >
          Hoàn thành · {candidates.filter((item) => item.status === 'completed').length}
        </button>
        <button
          className={statusFilter === 'rejected' ? 'active' : ''}
          onClick={() => {
            setStatusFilter('rejected')
            setSelected(0)
            setDecision('')
          }}
        >
          Chưa chọn · {candidates.filter((item) => item.status === 'rejected').length}
        </button>
        <span>Sắp xếp: Mới nhất</span>
      </div>

      {!person ? (
        <div className="empty-result">Không có ứng viên nào trong trạng thái này.</div>
      ) : (
        <div className="candidate-grid">
          <aside className="white-card selected-job">
            <span>VIỆC ĐÃ CHỌN</span>
            <h2>{person.title}</h2>
            <p>{person.company}</p>
            <span className="status recruiting">
              {person.status === 'completed'
                ? 'Đã hoàn thành'
                : person.status === 'hired'
                  ? 'Đã nhận người'
                  : 'Đang tuyển'}
            </span>
            <strong>{person.pay}</strong>
            <p>{person.place}</p>
            <p>{person.schedule}</p>
            <hr />
            <p>
              {person.status === 'hired'
                ? 'Công việc đã chuyển sang trạng thái Đã nhận người. Bạn có thể đánh dấu hoàn thành khi kết thúc ca làm.'
                : person.status === 'completed'
                  ? 'Ca làm đã hoàn tất. Hãy để lại đánh giá cho sinh viên.'
                  : 'Ứng viên tiếp theo chỉ cách bạn một cuộc trò chuyện.'}
            </p>
          </aside>

          <section className="white-card applicant-list">
            <h2>Ứng viên</h2>
            <p>Đang hiển thị {filteredCandidates.length} ứng viên</p>
            {filteredCandidates.map((item, index) => (
              <button
                className={person.id === item.id || selected === index ? 'active' : ''}
                key={item.id}
                onClick={() => {
                  setSelected(index)
                  setDecision('')
                  setReviewed(Boolean(item.employerReview))
                  setReviewComment(item.employerReview?.comment ?? '')
                  setReviewRating(item.employerReview?.rating ?? 5)
                }}
              >
                <strong>{item.studentName}</strong>
                <span>{item.studentSchool}</span>
                <small>Nộp ngày {item.date}</small>
                <em>
                  {
                    {
                      pending: 'Mới',
                      hired: 'Đã nhận',
                      rejected: 'Chưa chọn',
                      completed: 'Hoàn thành',
                    }[item.status]
                  }
                </em>
              </button>
            ))}
          </section>

          <section className="white-card candidate-profile">
            <h2>{person.studentName}</h2>
            <p>{person.studentSchool}</p>
            <hr />
            <span>GIỚI THIỆU</span>
            <p className="candidate-intro">{person.introduction}</p>
            <span>CV / HỒ SƠ ĐÍNH KÈM</span>
            <div className="file-box">
              <div>
                <strong>
                  {person.hasCV || person.cvName || person.cvUrl
                    ? person.cvName || `HoSo_${person.studentName}`
                    : 'Chưa đính kèm tệp'}
                </strong>
                <small>
                  {person.hasCV || person.cvName || person.cvUrl
                    ? isImageAttachment(person.cvName, person.cvUrl)
                      ? 'Đã đính kèm ảnh hồ sơ (JPG / PNG)'
                      : 'Đã đính kèm hồ sơ ứng tuyển (PDF)'
                    : 'Ứng viên không đính kèm tệp'}
                </small>
              </div>
              {(person.hasCV || person.cvName || person.cvUrl) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 'none' }}>
                  <button type="button" onClick={() => setPreviewPdfOpen((prev) => !prev)}>
                    <Eye size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    {previewPdfOpen ? 'Ẩn tệp' : 'Xem trực tiếp'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openAttachmentInBrowser(
                        person.cvUrl,
                        person.cvName || `HoSo_${person.studentName}`,
                      )
                    }
                  >
                    Mở tab mới ↗
                  </button>
                </div>
              )}
            </div>

            {(person.hasCV || person.cvName || person.cvUrl) && previewPdfOpen && (
              <div
                style={{
                  marginTop: '0.75rem',
                  marginBottom: '1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#f8fafc',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#eff3ee',
                    borderBottom: '1px solid #dfe5e1',
                    fontSize: '0.88rem',
                  }}
                >
                  <strong>{person.cvName || `HoSo_${person.studentName}`}</strong>
                  <button
                    type="button"
                    className="text-link"
                    style={{ padding: 0 }}
                    onClick={() =>
                      openAttachmentInBrowser(
                        person.cvUrl,
                        person.cvName || `HoSo_${person.studentName}`,
                      )
                    }
                  >
                    Mở toàn màn hình ↗
                  </button>
                </div>
                {person.cvUrl ? (
                  isImageAttachment(person.cvName, person.cvUrl) ? (
                    <div style={{ padding: '16px', textAlign: 'center', background: '#ffffff' }}>
                      <img
                        src={person.cvUrl}
                        alt={`Hồ sơ của ${person.studentName}`}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '520px',
                          objectFit: 'contain',
                          borderRadius: '6px',
                          display: 'inline-block',
                        }}
                      />
                    </div>
                  ) : (
                    <iframe
                      src={person.cvUrl}
                      title={`CV của ${person.studentName}`}
                      style={{ width: '100%', height: '460px', border: 0, display: 'block' }}
                    />
                  )
                ) : (
                  <div style={{ padding: '16px', fontSize: '14px' }}>
                    Đã đính kèm tệp:{' '}
                    <strong>{person.cvName || `HoSo_${person.studentName}`}</strong>.
                  </div>
                )}
              </div>
            )}

            <div className="decision-row">
              {person.status === 'pending' && (
                <>
                  <button
                    onClick={async () => {
                      const result = await updateApplicationStatusAction({
                        applicationId: person.id,
                        status: 'rejected',
                      })
                      if (result.ok) {
                        updateBothStates(person.id, 'rejected')
                        await onActionCompleted()
                      }
                      setDecision(result.ok ? 'Đã từ chối' : result.error)
                    }}
                  >
                    Từ chối
                  </button>
                  <button
                    onClick={async () => {
                      const result = await updateApplicationStatusAction({
                        applicationId: person.id,
                        status: 'hired',
                      })
                      if (result.ok) {
                        updateBothStates(person.id, 'hired')
                        syncJobStatus(person.jobId, 'filled')
                        setStatusFilter('hired')
                        setSelected(0)
                        await onActionCompleted()
                      }
                      setDecision(
                        result.ok
                          ? 'Đã duyệt và tuyển — công việc đã chuyển sang trạng thái Đã nhận người'
                          : result.error,
                      )
                    }}
                  >
                    Duyệt và tuyển
                  </button>
                </>
              )}

              {person.status === 'hired' && (
                <button
                  className="primary"
                  onClick={async () => {
                    const result = await updateApplicationStatusAction({
                      applicationId: person.id,
                      status: 'completed',
                    })
                    if (result.ok) {
                      updateBothStates(person.id, 'completed')
                      syncJobStatus(person.jobId, 'completed')
                      setStatusFilter('completed')
                      setSelected(0)
                      await onActionCompleted()
                    }
                    setDecision(
                      result.ok
                        ? 'Đã đánh dấu hoàn thành — bạn có thể đánh giá sinh viên ngay bên dưới'
                        : result.error,
                    )
                  }}
                >
                  Đánh dấu hoàn thành
                </button>
              )}
            </div>

            {person.status === 'completed' && (
              <div className="review-action">
                <h3>Đánh giá sinh viên {person.studentName}</h3>
                <RatingStars rating={reviewRating} onChange={setReviewRating} size={18} />
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  placeholder="Nhận xét về thái độ, kỹ năng và hiệu quả làm việc của sinh viên..."
                />
                <button
                  disabled={reviewed || Boolean(person.employerReview)}
                  onClick={async () => {
                    const result = await createReviewAction({
                      applicationId: person.id,
                      rating: reviewRating,
                      comment: reviewComment,
                    })
                    if (!result.ok) {
                      setDecision(result.error)
                      return
                    }
                    const reviewPayload: ReviewData = {
                      id: result.data?.reviewId,
                      rating: reviewRating,
                      comment: reviewComment,
                      date: 'Hôm nay',
                      reviewerName: person.company || employerName || 'Nhà tuyển dụng',
                      moderationStatus: 'approved',
                    }
                    setCandidates((current) =>
                      current.map((item) =>
                        item.id === person.id ? { ...item, employerReview: reviewPayload } : item,
                      ),
                    )
                    setApplications((current) =>
                      current.map((item) =>
                        item.id === person.id ? { ...item, employerReview: reviewPayload } : item,
                      ),
                    )
                    setReviewed(true)
                    setDecision(`Đã đăng đánh giá ${reviewRating} sao cho sinh viên`)
                    await onActionCompleted()
                  }}
                >
                  {reviewed || person.employerReview
                    ? 'Đã đăng đánh giá'
                    : `Đăng đánh giá ${reviewRating} sao`}
                </button>
              </div>
            )}

            {person.studentReview?.moderationStatus === 'approved' && (
              <div style={{ marginTop: '1.25rem' }}>
                <hr />
                <span>ĐÁNH GIÁ TỪ SINH VIÊN {person.studentName.toUpperCase()}</span>
                <div
                  className="file-box"
                  style={{ display: 'block', lineHeight: 1.6, marginTop: '0.5rem' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={16}
                        fill={star <= person.studentReview!.rating ? '#f59e0b' : 'none'}
                        color={star <= person.studentReview!.rating ? '#f59e0b' : '#9ca3af'}
                      />
                    ))}
                    <strong>{person.studentReview.rating} / 5 sao</strong>
                  </div>

                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.6rem 0.8rem',
                      margin: '0.5rem 0',
                      fontSize: '0.9rem',
                    }}
                  >
                    <div>
                      <strong>Công việc đã làm:</strong> {person.title} ({person.company})
                    </div>
                    <div>
                      <strong>Mức lương:</strong> {person.pay} · <strong>Lịch làm:</strong>{' '}
                      {person.schedule}
                    </div>
                    <div>
                      <strong>Địa điểm:</strong> {person.place} · <strong>Ngày ứng tuyển:</strong>{' '}
                      {person.date}
                    </div>
                  </div>

                  <p style={{ margin: '0.4rem 0 0' }}>
                    {person.studentReview.comment || 'Sinh viên đã gửi đánh giá phản hồi.'}
                  </p>
                  <small style={{ display: 'block', marginTop: '0.35rem' }}>
                    Gửi lúc: {person.studentReview.date}
                  </small>
                </div>
              </div>
            )}

            {decision && (
              <small className="decision-note">{decision}: Sinh viên sẽ nhận được thông báo.</small>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

function Signup({
  go,
  onVerificationCreated,
}: {
  go: (p: Page) => void
  onVerificationCreated: (data: VerificationPendingData) => void
}) {
  const [role, setRole] = useState<'student' | 'employer'>('student')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  return (
    <main className="signup-main">
      <section className="welcome-panel">
        <span>CHƯƠNG MỚI BẮT ĐẦU TỪ ĐÂY</span>
        <h1>
          Một chút công việc.
          <br />
          Rất nhiều
          <br />
          cơ hội.
        </h1>
        <p>Nơi sinh viên mọi ngành học tìm bước đi đầu tiên và doanh nghiệp tìm đúng người.</p>
        <hr />
        {[
          ['01', 'Tìm việc phù hợp', 'Công việc linh hoạt, tôn trọng lịch học.'],
          ['02', 'Tạo kết nối', 'Cơ hội thật với nhà tuyển dụng địa phương.'],
          ['03', 'Trưởng thành qua mỗi ca', 'Xây dựng kinh nghiệm và uy tín.'],
        ].map(([n, t, c]) => (
          <div className="welcome-step" key={n}>
            <span>{n}</span>
            <div>
              <strong>{t}</strong>
              <p>{c}</p>
            </div>
          </div>
        ))}
      </section>
      <section className="signup-form">
        <h1>Hãy bắt đầu.</h1>
        <p>Tạo tài khoản và xác thực qua Gmail của bạn.</p>
        <label>Tôi tham gia với vai trò...</label>
        <div className="role-options">
          <button
            type="button"
            className={role === 'student' ? 'active' : ''}
            onClick={() => setRole('student')}
          >
            {role === 'student' && '✓ '}Sinh viên
          </button>
          <button
            type="button"
            className={role === 'employer' ? 'active' : ''}
            onClick={() => setRole('employer')}
          >
            {role === 'employer' && '✓ '}Nhà tuyển dụng / cá nhân
          </button>
        </div>
        <label>
          Họ và tên
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nguyễn Minh Anh"
          />
        </label>
        <label>
          Địa chỉ Gmail
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="minhanh@gmail.com"
          />
        </label>
        {role === 'employer' && (
          <label>
            Tên doanh nghiệp / Cửa hàng
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Tên doanh nghiệp, cửa hàng hoặc tổ chức"
            />
          </label>
        )}
        <label>
          Mật khẩu
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Tạo mật khẩu an toàn"
          />
        </label>
        <label className="terms">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />{' '}
          Tôi đồng ý với Điều khoản dịch vụ và Chính sách riêng tư.
        </label>
        {error && <div className="login-error">{error}</div>}
        <button
          type="button"
          className="primary-wide"
          disabled={submitting}
          onClick={async () => {
            if (!agreed) {
              setError('Bạn cần đồng ý với điều khoản dịch vụ.')
              return
            }
            setSubmitting(true)
            const result = await signupAction({
              name,
              email,
              password,
              role,
              companyName,
            })
            setSubmitting(false)
            if (!result.ok || !result.data) {
              setError(result.ok ? 'Không thể tạo mã xác thực.' : result.error)
              return
            }
            try {
              const emailKey = email.trim().toLowerCase()
              const displayName =
                role === 'employer' && companyName.trim() ? companyName.trim() : name.trim()
              const savedMap = JSON.parse(
                window.localStorage.getItem('shiftly_registered_users') || '{}',
              )
              savedMap[emailKey] = { name: displayName, role }
              window.localStorage.setItem('shiftly_registered_users', JSON.stringify(savedMap))
            } catch {
              // ignore
            }
            setError('')
            onVerificationCreated(result.data)
            go('verify-email')
          }}
        >
          {submitting ? 'Đang gửi mã xác thực...' : 'Tiếp tục & Gửi mã về Gmail'}
        </button>
        <button type="button" className="text-link" onClick={() => go('login')}>
          Đã có tài khoản? Đăng nhập →
        </button>
        <hr />
        <button type="button" className="admin-demo" onClick={() => go('admin')}>
          Tài khoản quản trị chỉ dành cho người được mời · Xem demo quản trị →
        </button>
      </section>
    </main>
  )
}

function VerifyEmail({
  pending,
  onUpdatePending,
  go,
}: {
  pending: VerificationPendingData | null
  onUpdatePending: (data: VerificationPendingData) => void
  go: (p: Page) => void
}) {
  const [codeInput, setCodeInput] = useState('')
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [verifiedSuccess, setVerifiedSuccess] = useState(false)

  if (!pending) {
    return (
      <main className="login-main">
        <section className="login-message">
          <span>XÁC THỰC GMAIL</span>
          <h1>Chưa có phiên xác thực.</h1>
          <p>Vui lòng quay lại trang đăng ký để nhập thông tin và nhận mã xác thực Gmail.</p>
          <button className="primary-wide" onClick={() => go('signup')}>
            Quay lại đăng ký <ArrowRight size={14} />
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="login-main">
      <section className="login-message">
        <span>BƯỚC CUỐI CÙNG · XÁC THỰC GMAIL</span>
        <h1>
          Kiểm tra Gmail
          <br />
          và nhập mã xác thực.
        </h1>
        <p>
          Hệ thống đã gửi mã OTP 6 chữ số tới địa chỉ <strong>{pending.email}</strong>.
        </p>
        <div
          className="demo-accounts"
          style={{
            background: '#eff6f1',
            border: '1px solid #114232',
            borderRadius: '8px',
            padding: '14px 16px',
          }}
        >
          <strong>Đã gửi thư về Gmail</strong>
          <p style={{ margin: '6px 0' }}>{pending.previewHint}</p>
        </div>
      </section>

      <div className="login-form">
        {verifiedSuccess ? (
          <div style={{ padding: '12px 0' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '999px',
                background: '#dcfce7',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <Check size={26} />
            </div>
            <span>XÁC THỰC THÀNH CÔNG</span>
            <h1>Đăng ký thành công!</h1>
            <p>
              Địa chỉ Gmail <strong>{pending.email}</strong> đã được xác thực hợp lệ. Bây giờ bạn
              có thể đăng nhập vào hệ thống bằng tài khoản vừa tạo.
            </p>
            <button
              type="button"
              className="primary-wide"
              style={{ marginTop: '14px' }}
              onClick={() => go('login')}
            >
              Đăng nhập ngay <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setVerifying(true)
              setError('')
              const res = await verifyEmailCodeAction({
                email: pending.email,
                code: codeInput,
              })
              setVerifying(false)
              if (!res.ok) {
                setError(res.error)
                return
              }
              setVerifiedSuccess(true)
            }}
          >
            <span>NHẬP MÃ XÁC NHẬN</span>
            <h1>Xác thực địa chỉ Gmail</h1>
            <p>
              Nhập mã 6 chữ số đã gửi tới <strong>{pending.email}</strong>
            </p>
            <label>
              Mã xác thực (6 chữ số)
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Nhập mã OTP 6 số"
                style={{ letterSpacing: '4px', fontSize: '18px', fontWeight: 700 }}
                required
              />
            </label>
            {infoMessage && (
              <div className="admin-notice" style={{ marginBottom: '10px' }}>
                <Check size={14} /> {infoMessage}
              </div>
            )}
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="primary-wide" disabled={verifying}>
              {verifying ? 'Đang kiểm tra mã...' : 'Xác nhận & Hoàn tất đăng ký'}{' '}
              <ArrowRight size={14} />
            </button>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '12px',
              }}
            >
              <button
                type="button"
                className="text-link"
                style={{ padding: 0 }}
                disabled={resending}
                onClick={async () => {
                  setResending(true)
                  setError('')
                  const res = await resendVerificationCodeAction(pending.email)
                  setResending(false)
                  if (!res.ok || !res.data) {
                    setError(res.ok ? 'Không thể gửi lại mã.' : res.error)
                    return
                  }
                  onUpdatePending(res.data)
                  setInfoMessage('Đã gửi lại mã xác thực mới về Gmail!')
                  window.setTimeout(() => setInfoMessage(''), 2500)
                }}
              >
                {resending ? 'Đang gửi lại...' : 'Gửi lại mã xác thực'}
              </button>
              <button
                type="button"
                className="text-link"
                style={{ padding: 0 }}
                onClick={() => go('signup')}
              >
                ← Đổi Gmail khác
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}

function ForgotPassword({ go }: { go: (p: Page) => void }) {
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <main className="login-main">
      <section className="login-message">
        <span>KHÔI PHỤC TÀI KHOẢN</span>
        <h1>
          Quên mật khẩu?
          <br />
          Lấy lại chỉ trong 1 phút.
        </h1>
        <p>Nhập Gmail đã đăng ký, hệ thống sẽ gửi mã OTP 6 chữ số để bạn đặt lại mật khẩu mới.</p>
        {hint && (
          <div
            className="demo-accounts"
            style={{
              background: '#eff6f1',
              border: '1px solid #114232',
              borderRadius: '8px',
              padding: '14px 16px',
            }}
          >
            <strong>Đã gửi OTP về Gmail</strong>
            <p style={{ margin: '6px 0 0' }}>{hint}</p>
          </div>
        )}
      </section>

      <div className="login-form">
        {step === 'done' ? (
          <div style={{ padding: '12px 0' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '999px',
                background: '#dcfce7',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <Check size={26} />
            </div>
            <span>HOÀN TẤT KHÔI PHỤC</span>
            <h1>Đổi mật khẩu thành công!</h1>
            <p>
              Mật khẩu cho tài khoản <strong>{email}</strong> đã được cập nhật. Bạn có thể đăng
              nhập ngay bằng mật khẩu mới.
            </p>
            <button
              type="button"
              className="primary-wide"
              style={{ marginTop: '14px' }}
              onClick={() => go('login')}
            >
              Quay lại đăng nhập <ArrowRight size={14} />
            </button>
          </div>
        ) : step === 'request' ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setLoading(true)
              setError('')
              const res = await requestPasswordResetAction(email)
              setLoading(false)
              if (!res.ok || !res.data) {
                setError(res.ok ? 'Không thể gửi mã OTP.' : res.error)
                return
              }
              setHint(res.data.previewHint)
              setStep('reset')
            }}
          >
            <span>BƯỚC 1 / 2</span>
            <h1>Nhập Gmail đã đăng ký</h1>
            <p>Chúng tôi sẽ gửi mã xác nhận gồm 6 chữ số tới hộp thư của bạn.</p>
            <label>
              Địa chỉ Gmail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@gmail.com"
                required
              />
            </label>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="primary-wide" disabled={loading}>
              {loading ? 'Đang gửi mã OTP...' : 'Gửi mã OTP về Gmail'} <ArrowRight size={14} />
            </button>
            <button
              type="button"
              className="text-link"
              style={{ marginTop: '12px', display: 'block', padding: 0 }}
              onClick={() => go('login')}
            >
              ← Quay lại đăng nhập
            </button>
          </form>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (newPassword !== confirmPassword) {
                setError('Mật khẩu xác nhận không khớp.')
                return
              }
              setLoading(true)
              setError('')
              const res = await resetPasswordWithOtpAction({
                email,
                code,
                newPassword,
              })
              setLoading(false)
              if (!res.ok) {
                setError(res.error)
                return
              }
              setStep('done')
            }}
          >
            <span>BƯỚC 2 / 2</span>
            <h1>Đặt lại mật khẩu mới</h1>
            <p>
              Nhập mã OTP đã gửi tới <strong>{email}</strong> và mật khẩu mới.
            </p>
            <label>
              Mã OTP (6 chữ số)
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Nhập mã OTP 6 số"
                style={{ letterSpacing: '4px', fontSize: '18px', fontWeight: 700 }}
                required
              />
            </label>
            <label>
              Mật khẩu mới
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ít nhất 6 ký tự"
                required
              />
            </label>
            <label>
              Nhập lại mật khẩu mới
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                required
              />
            </label>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="primary-wide" disabled={loading}>
              {loading ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'} <ArrowRight size={14} />
            </button>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '12px',
              }}
            >
              <button
                type="button"
                className="text-link"
                style={{ padding: 0 }}
                disabled={loading}
                onClick={async () => {
                  setLoading(true)
                  setError('')
                  const res = await requestPasswordResetAction(email)
                  setLoading(false)
                  if (!res.ok || !res.data) {
                    setError(res.ok ? 'Không thể gửi lại mã.' : res.error)
                    return
                  }
                  setHint('Đã gửi lại mã OTP mới tới hộp thư Gmail của bạn!')
                }}
              >
                Gửi lại mã OTP
              </button>
              <button
                type="button"
                className="text-link"
                style={{ padding: 0 }}
                onClick={() => {
                  setStep('request')
                  setCode('')
                  setError('')
                }}
              >
                ← Đổi email khác
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}

function Admin({
  section,
  initialUsers,
  initialJobs,
  initialReviews,
  refreshJobs,
}: {
  section: Page
  initialUsers: AdminUserRow[]
  initialJobs: AdminJobRow[]
  initialReviews: AdminReviewRow[]
  refreshJobs: () => Promise<unknown> | void
}) {
  const [search, setSearch] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [userList, setUserList] = useState(initialUsers)
  const [pendingJobs, setPendingJobs] = useState(initialJobs)
  const [reviews, setReviews] = useState(initialReviews)
  const [inspectedJob, setInspectedJob] = useState<AdminJobRow | null>(null)

  useEffect(() => setUserList(initialUsers), [initialUsers])
  useEffect(() => setPendingJobs(initialJobs), [initialJobs])
  useEffect(() => setReviews(initialReviews), [initialReviews])

  const users = userList.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  )
  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  const handleDecision = async (jobId: string, status: 'approved' | 'rejected') => {
    const result = await moderateJobAction({ jobId, status })
    if (!result.ok) {
      flash(result.error)
      return
    }
    setPendingJobs((current) => current.filter((item) => item.id !== jobId))
    if (inspectedJob?.id === jobId) {
      setInspectedJob(null)
    }
    flash(
      status === 'approved'
        ? 'Đã duyệt tin tuyển dụng và cập nhật danh sách việc làm.'
        : 'Đã từ chối và gỡ tin khỏi hàng chờ kiểm duyệt.',
    )
    await refreshJobs()
  }

  const peoplePanel = (
    <section className="white-card people-card">
      <div className="card-heading">
        <h2>Người dùng & phân quyền</h2>
        <button onClick={() => setInviteOpen(!inviteOpen)}>Mời quản trị viên</button>
      </div>
      {inviteOpen && (
        <form
          className="admin-invite"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const email = String(form.get('email') || '')
            const password = String(form.get('password') || '')
            if (!email || !password) return
            void createAdminAction({ email, password }).then(async (result) => {
              if (!result.ok) {
                flash(result.error)
                return
              }
              setUserList((current) => [
                ...current,
                {
                  id: result.data?.id ?? email,
                  name: 'Quản trị viên mới',
                  email,
                  role: 'admin',
                  active: true,
                },
              ])
              setInviteOpen(false)
              flash('Đã tạo tài khoản quản trị viên.')
              await refreshJobs()
            })
          }}
        >
          <input name="email" type="email" placeholder="Email quản trị viên mới" required />
          <input
            name="password"
            type="password"
            placeholder="Mật khẩu tạm thời (8+ ký tự)"
            required
          />
          <button type="submit">Tạo tài khoản</button>
        </form>
      )}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Tìm theo tên hoặc email..."
      />
      <div className="table-head admin-table">
        <span>TÊN / EMAIL</span>
        <span>VAI TRÒ</span>
        <span>TRUY CẬP</span>
        <span>THAO TÁC</span>
      </div>
      {users.map((user) => (
        <div className="table-row admin-table" key={user.id}>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <select
            value={user.role}
            onChange={(e) => {
              const role = e.target.value as AdminUserRow['role']
              void updateUserAction({ userId: user.id, role }).then(async (result) => {
                if (!result.ok) return flash(result.error)
                setUserList((current) =>
                  current.map((item) => (item.id === user.id ? { ...item, role } : item)),
                )
                flash('Đã cập nhật vai trò.')
                await refreshJobs()
              })
            }}
          >
            <option value="student">Sinh viên</option>
            <option value="employer">Nhà tuyển dụng</option>
            <option value="admin">Quản trị viên</option>
          </select>
          <span className={user.active ? 'green-text' : 'muted-text'}>
            {user.active ? 'Hoạt động' : 'Đã khóa'}
          </span>
          <button
            type="button"
            onClick={() => {
              const nextActive = !user.active
              const accountStatus = nextActive ? 'active' : 'suspended'
              void updateUserAction({
                userId: user.id,
                accountStatus,
                active: nextActive,
              }).then(async (result) => {
                if (!result.ok) return flash(result.error)
                setUserList((current) =>
                  current.map((item) =>
                    item.id === user.id ? { ...item, active: nextActive } : item,
                  ),
                )
                flash(nextActive ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.')
                await refreshJobs()
              })
            }}
          >
            {user.active ? 'Khóa' : 'Mở khóa'}
          </button>
        </div>
      ))}
    </section>
  )

  const moderationPanel = (
    <section className="white-card admin-workspace-card">
      <div className="card-heading">
        <div>
          <h2>Kiểm duyệt việc làm</h2>
          <p>{pendingJobs.length} tin đang chờ xử lý</p>
        </div>
      </div>

      {inspectedJob && (
        <div className="white-card" style={{ marginBottom: '1rem', border: '1px solid #d1d5db' }}>
          <div className="card-heading">
            <div>
              <small>{inspectedJob.company}</small>
              <h3>Chi tiết tin: {inspectedJob.title}</h3>
            </div>
            <button onClick={() => setInspectedJob(null)}>Đóng xem trước</button>
          </div>
          <p>
            <strong>Mức lương:</strong> {inspectedJob.pay} · <strong>Ngành nghề:</strong>{' '}
            {inspectedJob.category || 'Đa ngành nghề'} · <strong>Địa điểm:</strong>{' '}
            {inspectedJob.place || 'Việt Nam'}
          </p>
          <p>
            <strong>Lịch làm việc:</strong> {inspectedJob.schedule || 'Linh hoạt'}
          </p>
          <p>
            <strong>Mô tả công việc:</strong>{' '}
            {inspectedJob.description || 'Chưa cung cấp mô tả chi tiết.'}
          </p>
          <p>
            <strong>Yêu cầu ứng viên:</strong>{' '}
            {inspectedJob.requirements || 'Chưa cung cấp yêu cầu cụ thể.'}
          </p>
          <div className="moderation-actions">
            <button onClick={() => void handleDecision(inspectedJob.id, 'rejected')}>Từ chối</button>
            <button onClick={() => void handleDecision(inspectedJob.id, 'approved')}>Duyệt tin</button>
          </div>
        </div>
      )}

      {!pendingJobs.length ? (
        <div className="empty-result">
          Hiện không có tin tuyển dụng nào đang chờ kiểm duyệt.
        </div>
      ) : (
        <div className="admin-job-list">
          {pendingJobs.map((job) => (
            <article key={job.id}>
              <div>
                <span>{job.company}</span>
                <h3>{job.title}</h3>
                <p>
                  {job.pay} · {job.category || 'Đa ngành nghề'} · {job.place || 'Việt Nam'}
                </p>
              </div>
              <span className="status review">{job.status}</span>
              <div className="moderation-actions">
                <button onClick={() => setInspectedJob(job)}>
                  <Eye size={14} /> Xem chi tiết
                </button>
                <button onClick={() => void handleDecision(job.id, 'rejected')}>Từ chối</button>
                <button onClick={() => void handleDecision(job.id, 'approved')}>Duyệt tin</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )

  const reviewsPanel = (
    <section className="white-card admin-workspace-card">
      <div className="card-heading">
        <div>
          <h2>Quản lý đánh giá</h2>
          <p>Duyệt đánh giá hai chiều trước khi hiển thị cho nhà tuyển dụng</p>
        </div>
      </div>
      {!reviews.length ? (
        <div className="empty-result">Chưa có đánh giá nào trên hệ thống.</div>
      ) : (
        <div className="admin-review-list">
          {reviews.map((review) => (
            <article key={review.id}>
              <div>
                <strong>{review.author}</strong>
                <span> đánh giá </span>
                <strong>{review.target}</strong>
                <div className="mini-stars">
                  {'★'.repeat(review.rating)}
                  {'☆'.repeat(5 - review.rating)}
                </div>
                <p>{review.content}</p>
              </div>
              <span className={`status ${review.status === 'Đang hiển thị' ? 'hired' : 'review'}`}>
                {review.status}
              </span>
              <div className="moderation-actions">
                <button
                  onClick={async () => {
                    const result = await updateReviewAction({
                      reviewId: review.id,
                      visibility: 'hidden',
                    })
                    if (!result.ok) return flash(result.error)
                    setReviews((current) =>
                      current.map((item) =>
                        item.id === review.id ? { ...item, status: 'Đã ẩn' } : item,
                      ),
                    )
                    flash('Đã ẩn đánh giá.')
                    await refreshJobs()
                  }}
                >
                  Ẩn đánh giá
                </button>
                <button
                  onClick={async () => {
                    const result = await updateReviewAction({
                      reviewId: review.id,
                      visibility: 'visible',
                    })
                    if (!result.ok) return flash(result.error)
                    setReviews((current) =>
                      current.map((item) =>
                        item.id === review.id ? { ...item, status: 'Đang hiển thị' } : item,
                      ),
                    )
                    flash('Đã duyệt và hiển thị đánh giá cho nhà tuyển dụng.')
                    await refreshJobs()
                  }}
                >
                  Duyệt hiển thị
                </button>
                <button
                  onClick={async () => {
                    const result = await updateReviewAction({
                      reviewId: review.id,
                      action: 'delete',
                    })
                    if (!result.ok) return flash(result.error)
                    setReviews((current) => current.filter((item) => item.id !== review.id))
                    flash('Đã xóa đánh giá vĩnh viễn.')
                    await refreshJobs()
                  }}
                >
                  <Trash2 size={14} /> Xóa
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )

  const titles: Record<string, [string, string]> = {
    admin: [
      'Nền tảng lành mạnh bắt đầu từ đây.',
      'Theo dõi hoạt động, quản lý quyền truy cập và giữ mọi cơ hội đáng tin cậy.',
    ],
    'admin-users': [
      'Quản lý người dùng và quyền truy cập.',
      'Tìm kiếm, phân vai trò và kiểm soát trạng thái tài khoản.',
    ],
    'admin-jobs': [
      'Giữ cơ hội việc làm đáng tin cậy.',
      'Xem chi tiết, duyệt nội dung hoặc từ chối tin tuyển dụng trước khi xuất bản.',
    ],
    'admin-reviews': [
      'Duy trì cộng đồng công bằng.',
      'Kiểm tra đánh giá hai chiều và xử lý nội dung bị báo cáo.',
    ],
  }
  const [title, copy] = titles[section] || titles.admin
  return (
    <main>
      <Hero eyebrow="QUẢN TRỊ" title={title} copy={copy} />
      {notice && (
        <div className="admin-notice">
          <Check size={14} />
          {notice}
        </div>
      )}
      <StatGrid
        items={[
          [
            'Người dùng hoạt động',
            String(userList.filter((user) => user.active).length),
            'Sinh viên, nhà tuyển dụng và quản trị',
          ],
          ['Việc chờ duyệt', String(pendingJobs.length), 'Đang chờ kiểm duyệt'],
          [
            'Đánh giá chờ duyệt',
            String(reviews.filter((r) => r.status === 'Chờ duyệt').length),
            'Đánh giá mới từ sinh viên',
          ],
          ['Tổng đánh giá', String(reviews.length), 'Trên toàn nền tảng'],
        ]}
      />
      {section === 'admin-users' ? (
        <div className="admin-full">{peoplePanel}</div>
      ) : section === 'admin-jobs' ? (
        <div className="admin-full">{moderationPanel}</div>
      ) : section === 'admin-reviews' ? (
        <div className="admin-full">{reviewsPanel}</div>
      ) : (
        <div className="admin-grid">
          {peoplePanel}
          <aside className="white-card moderation">
            <h2>Cần bạn xử lý</h2>
            <p>{pendingJobs.length} việc đang chờ duyệt</p>
            {pendingJobs.slice(0, 2).map((job) => (
              <div key={job.id}>
                <h3>{job.title}</h3>
                <p>{job.company}</p>
                <button onClick={() => setInspectedJob(job)}>Xem chi tiết →</button>
              </div>
            ))}
          </aside>
          <section className="white-card roles-card">
            <h2>Đúng quyền cho từng vai trò</h2>
            <div>
              {[
                [
                  'Sinh viên',
                  String(userList.filter((user) => user.role === 'student').length),
                  'Tìm kiếm, ứng tuyển và đánh giá',
                ],
                [
                  'Nhà tuyển dụng',
                  String(userList.filter((user) => user.role === 'employer').length),
                  'Đăng việc, tuyển và đánh giá',
                ],
                [
                  'Quản trị viên',
                  String(userList.filter((user) => user.role === 'admin').length),
                  'Quản lý người dùng và kiểm duyệt',
                ],
              ].map(([r, n, c]) => (
                <article key={r}>
                  <span>{r}</span>
                  <strong>{n}</strong>
                  <small>{c}</small>
                </article>
              ))}
            </div>
          </section>
          <aside className="recent-card">
            <h2>Hoạt động gần đây</h2>
            <h3>Một nơi làm việc đáng tin cậy.</h3>
            <p>Dữ liệu người dùng, kiểm duyệt việc và đánh giá được cập nhật liên tục.</p>
            <button onClick={() => void refreshJobs()}>Làm mới hoạt động →</button>
          </aside>
        </div>
      )}
    </main>
  )
}

function Saved({
  jobs,
  savedJobs,
  go,
  removeSaved,
  selectJob,
}: {
  jobs: Job[]
  savedJobs: SavedJobRow[]
  go: (p: Page) => void
  removeSaved: (savedId: string) => Promise<void>
  selectJob: (job: Job) => void
}) {
  const rows = savedJobs.flatMap((saved) => {
    const job = jobs.find((item) => item.id === saved.jobId)
    return job ? [{ saved, job }] : []
  })
  return (
    <main>
      <Hero
        eyebrow="VIỆC ĐÃ LƯU"
        title="Những cơ hội đáng xem lại."
        copy="Lưu công việc phù hợp và quay lại ứng tuyển khi bạn sẵn sàng."
      />
      <div className="saved-grid">
        {rows.map(({ saved, job }) => (
          <article className="job-card" key={job.id}>
            <div className="job-topline">
              <span>{job.company}</span>
              <strong>{job.pay}</strong>
            </div>
            <h3>{job.title}</h3>
            <p>
              {job.place} · {job.schedule}
            </p>
            <div className="job-bottomline">
              <span className="job-category">{job.category}</span>
              <small>{job.posted}</small>
              <button
                onClick={() => {
                  selectJob(job)
                  go('detail')
                }}
              >
                Xem việc →
              </button>
              <button onClick={() => void removeSaved(saved.id)}>Bỏ lưu</button>
            </div>
          </article>
        ))}
        {!rows.length && <div className="empty-result">Bạn chưa lưu công việc nào để xem lại.</div>}
      </div>
    </main>
  )
}

function Login({
  onLogin,
  go,
  hasPendingVerification,
}: {
  onLogin: (email: string, password: string) => Promise<string | null>
  go: (page: Page) => void
  hasPendingVerification: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    const message = await onLogin(email.trim().toLowerCase(), password)
    setPending(false)
    setError(message || '')
  }
  return (
    <main className="login-main">
      <section className="login-message">
        <span>CƠ HỘI VIỆC LÀM QUANH BẠN</span>
        <h1>
          Đăng nhập.
          <br />
          Bắt đầu bước tiếp theo.
        </h1>
        <p>Theo dõi đơn ứng tuyển, quản lý công việc và kết nối với đúng người.</p>
      </section>
      <form className="login-form" onSubmit={submit}>
        <span>CHÀO MỪNG TRỞ LẠI</span>
        <h1>Đăng nhập tài khoản</h1>
        <p>Nhập email và mật khẩu để tiếp tục.</p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@gmail.com"
          />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu"
          />
        </label>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '-4px',
            marginBottom: '8px',
          }}
        >
          <button
            type="button"
            className="text-link"
            style={{ padding: 0, fontSize: '13px', fontWeight: 600 }}
            onClick={() => go('forgot-password')}
          >
            Quên mật khẩu?
          </button>
        </div>
        {error && (
          <div className="login-error">
            {error}
            {hasPendingVerification && error.includes('chưa được xác thực') && (
              <div style={{ marginTop: '6px' }}>
                <button
                  type="button"
                  className="text-link"
                  style={{ padding: 0, fontWeight: 700 }}
                  onClick={() => go('verify-email')}
                >
                  Nhập mã xác thực Gmail ngay →
                </button>
              </div>
            )}
          </div>
        )}
        <button type="submit" className="primary-wide">
          {pending ? 'Đang đăng nhập...' : 'Đăng nhập'} <ArrowRight size={14} />
        </button>
        <p className="register-prompt">
          Bạn chưa có tài khoản?{' '}
          <button type="button" onClick={() => go('signup')}>
            Đăng ký ngay
          </button>
        </p>
        <small>Phiên đăng nhập được bảo vệ bằng cookie HTTP-only.</small>
      </form>
    </main>
  )
}

function Footer({ go }: { go: (page: Page) => void }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer
      style={{
        backgroundColor: '#114232',
        color: '#e6eee9',
        marginTop: '64px',
        padding: '52px 24px 28px',
        position: 'relative',
      }}
    >
      <div
        style={{
          maxWidth: '1160px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '36px',
          paddingBottom: '36px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.14)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: '12px',
            }}
          >
            <span style={{ color: '#ffffff' }}>shiftly</span>
            <span style={{ color: '#d7ee9b' }}>SV</span>
          </div>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: '#c4d5cc' }}>
            Nền tảng kết nối sinh viên với việc làm bán thời gian gần trường, lương rõ ràng, ca linh
            hoạt.
          </p>
        </div>

        <div>
          <h4
            style={{
              margin: '0 0 14px',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: '#d7ee9b',
            }}
          >
            SINH VIÊN
          </h4>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: '10px',
              fontSize: '14px',
            }}
          >
            <li>
              <button
                type="button"
                onClick={() => go('jobs')}
                style={{
                  background: 'none',
                  border: 0,
                  padding: 0,
                  color: '#e6eee9',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                Tìm việc làm
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => go('applications')}
                style={{
                  background: 'none',
                  border: 0,
                  padding: 0,
                  color: '#e6eee9',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                Đơn ứng tuyển của tôi
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => go('signup')}
                style={{
                  background: 'none',
                  border: 0,
                  padding: 0,
                  color: '#e6eee9',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                Tạo tài khoản
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4
            style={{
              margin: '0 0 14px',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: '#d7ee9b',
            }}
          >
            NHÀ TUYỂN DỤNG
          </h4>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: '10px',
              fontSize: '14px',
            }}
          >
            <li>
              <button
                type="button"
                onClick={() => go('post-job')}
                style={{
                  background: 'none',
                  border: 0,
                  padding: 0,
                  color: '#e6eee9',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                Đăng tin tuyển dụng
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => go('employer')}
                style={{
                  background: 'none',
                  border: 0,
                  padding: 0,
                  color: '#e6eee9',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                Quản lý tin đã đăng
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => go('signup')}
                style={{
                  background: 'none',
                  border: 0,
                  padding: 0,
                  color: '#e6eee9',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                Tạo tài khoản
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4
            style={{
              margin: '0 0 14px',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: '#d7ee9b',
            }}
          >
            LIÊN HỆ
          </h4>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: '10px',
              fontSize: '14px',
              color: '#e6eee9',
            }}
          >
            <li>Facebook</li>
            <li>Email: nhom6@gmail.com</li>
            <li>SĐT: 0777 772 405</li>
            <li style={{ lineHeight: 1.55 }}>
              Địa chỉ: 69/68 Đặng Thùy Trâm, P. Bình Lợi Trung, TP. Hồ Chí Minh
            </li>
          </ul>
        </div>
      </div>

      <div
        style={{
          maxWidth: '1160px',
          margin: '20px auto 0',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          fontSize: '13px',
          color: '#adc3b7',
        }}
      >
        <span>© 2026 Shiftly. Nhóm VTK06, Trường Đại học Văn Lang.</span>
        <span>Đồ án Chuyên đề tốt nghiệp 2</span>
      </div>

      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Lên đầu trang"
        title="Lên đầu trang"
        style={{
          position: 'fixed',
          right: '22px',
          bottom: '22px',
          width: '42px',
          height: '42px',
          borderRadius: '999px',
          border: '1px solid rgba(255,255,255,0.2)',
          backgroundColor: '#1a5c46',
          color: '#ffffff',
          fontSize: '18px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
          zIndex: 40,
        }}
      >
        ↑
      </button>
    </footer>
  )
}

export default function App({
  initialJobs,
  initialAuth = 'guest',
  initialAdminUsers,
  initialAdminJobs,
  initialAdminReviews,
  initialApplications,
  initialSavedJobs,
  initialNotifications,
  initialEmployerJobs,
  initialUserName,
}: {
  initialJobs: Job[]
  initialAuth: AuthRole
  initialAdminUsers: AdminUserRow[]
  initialAdminJobs: AdminJobRow[]
  initialAdminReviews: AdminReviewRow[]
  initialApplications: ApplicationRow[]
  initialSavedJobs: SavedJobRow[]
  initialNotifications: NotificationRow[]
  initialEmployerJobs: EmployerJobRow[]
  initialUserName: string
}) {
  const router = useRouter()
  const [page, setPage] = useState<Page>('jobs')
  const [returnToPage, setReturnToPage] = useState<Page | null>(null)
  const [pendingVerification, setPendingVerification] = useState<VerificationPendingData | null>(
    null,
  )

  const [auth, setAuth] = useState<AuthRole>('guest')
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const [selectedJob, setSelectedJob] = useState<Job | null>(initialJobs[0] ?? null)
  const [viewingApplication, setViewingApplication] = useState<ApplicationRow | null>(null)
  const [savedJobs, setSavedJobs] = useState(initialSavedJobs)
  const [applications, setApplications] = useState(initialApplications)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [employerJobs, setEmployerJobs] = useState(initialEmployerJobs)
  const [adminUsers, setAdminUsers] = useState(initialAdminUsers)
  const [adminJobs, setAdminJobs] = useState(initialAdminJobs)
  const [adminReviews, setAdminReviews] = useState(initialAdminReviews)
  const [userName, setUserName] = useState(initialUserName)
  const [profileData, setProfileData] = useState<UserProfileData>({
    role: 'student',
    name: initialUserName || 'Nguyễn Văn Vinh',
    email: '',
    phone: '',
    school: '',
    major: '',
    bio: '',
    defaultCvName: '',
    defaultCvUrl: '',
    companyName: initialUserName || 'Đơn vị tuyển dụng đối tác',
    companyArea: 'TP. Hồ Chí Minh',
    companyAddress: '',
    companyDescription: '',
    isProfileCompleted: false,
  })

  const syncDataFromSession = async (forceProfile = false) => {
    const result = await getMarketplaceSessionAction()
    if (!result.ok || !result.data) return
    setApplications(result.data.applications)
    setSavedJobs(result.data.savedJobs)
    setNotifications(result.data.notifications)
    setEmployerJobs(result.data.employerJobs)
    setAdminUsers(result.data.adminUsers)
    setAdminJobs(result.data.adminJobs)
    setAdminReviews(result.data.adminReviews)
    if (result.data.profile && auth !== 'guest' && (forceProfile || page !== 'profile')) {
      setProfileData(result.data.profile)
      setUserName(result.data.profile.name || '')
    }

    if (result.data.approvedJobs) {
      setJobs((currentJobs) => {
        const dynamicIds = new Set(
          (result.data.employerJobs || []).map((j: EmployerJobRow) => j.id),
        )
        const staticSeedJobs = currentJobs.filter((j) => !dynamicIds.has(j.id))
        return [...result.data.approvedJobs, ...staticSeedJobs]
      })
    }
  }

  useEffect(() => {
    void (async () => {
      const result = await getMarketplaceSessionAction()
      if (result.ok && result.data?.approvedJobs) {
        setJobs((currentJobs) => {
          const dynamicIds = new Set(
            (result.data.employerJobs || []).map((j: EmployerJobRow) => j.id),
          )
          const staticSeedJobs = currentJobs.filter((j) => !dynamicIds.has(j.id))
          return [...result.data.approvedJobs, ...staticSeedJobs]
        })
      }

      const savedSession = readPersistedSession()
      if (savedSession?.email && savedSession?.password) {
        const savedPage = readPersistedPage()
        await login(savedSession.email, savedSession.password, {
          restoredPage: savedPage,
          skipPersistOverwrite: true,
        })
      }
    })()
  }, [])

  useEffect(() => {
    if (auth === 'guest') return
    const timer = window.setInterval(() => {
      void syncDataFromSession()
    }, 3000)
    const onFocus = () => {
      void syncDataFromSession()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [auth, page])

  const toggleSaved = async (jobId: string) => {
    const existing = savedJobs.find((saved) => saved.jobId === jobId)
    if (existing) {
      const result = await unsaveJobAction(existing.id)
      if (result.ok) setSavedJobs((current) => current.filter((item) => item.id !== existing.id))
      return
    }
    const result = await saveJobAction(jobId)
    if (result.ok && result.data) {
      setSavedJobs((current) => [...current, { id: result.data!.id, jobId }])
    }
  }

  const canAccessPage = (next: Page, currentAuth: AuthRole) => {
    const protectedStudent: Page[] = ['applications', 'saved']
    const protectedEmployer: Page[] = ['employer', 'post-job', 'candidates']
    const protectedSignedIn: Page[] = ['profile']
    if (
      (protectedStudent.includes(next) && currentAuth !== 'student') ||
      (protectedEmployer.includes(next) && currentAuth !== 'employer') ||
      (protectedSignedIn.includes(next) &&
        currentAuth !== 'student' &&
        currentAuth !== 'employer') ||
      (next.startsWith('admin') && currentAuth !== 'admin')
    ) {
      return false
    }
    return true
  }

  const go = (next: Page) => {
    if (!canAccessPage(next, auth)) {
      setPage('login')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (next !== 'profile') {
      setReturnToPage(null)
    }
    setPage(next)
    if (auth !== 'guest') {
      writePersistedPage(next)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (auth !== 'guest' && next !== 'profile') {
      void syncDataFromSession()
    }
  }

  const handleMarkNotificationRead = async (notificationId: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
    )
    await markNotificationReadAction(notificationId)
    await syncDataFromSession()
  }

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })))
    await markAllNotificationsReadAction()
    await syncDataFromSession()
  }

  const handleSelectNotification = async (notif: NotificationRow) => {
    await handleMarkNotificationRead(notif.id)
    if (notif.targetPage) {
      go(notif.targetPage)
    }
  }

  const handleToggleEmployerJobStatus = async (
    jobId: string,
    nextStatus: 'recruiting' | 'paused',
  ) => {
    const res = await updateEmployerJobStatusAction({ jobId, status: nextStatus })
    if (!res.ok) return
    setEmployerJobs((current) =>
      current.map((item) => (item.id === jobId ? { ...item, status: nextStatus } : item)),
    )
    await syncDataFromSession()
  }

  const login = async (
    email: string,
    password: string,
    options?: { restoredPage?: Page | null; skipPersistOverwrite?: boolean },
  ) => {
    const emailLower = email.trim().toLowerCase()
    let storedUser: { name?: string; role?: AuthRole } = {}
    try {
      const savedMap = JSON.parse(
        window.localStorage.getItem('shiftly_registered_users') || '{}',
      )
      if (savedMap[emailLower]) {
        storedUser = savedMap[emailLower]
      }
    } catch {
      // ignore
    }

    const result = await loginAction({
      email: emailLower,
      password,
      fallbackName: storedUser.name,
    })
    if (!result.ok) {
      if (options?.skipPersistOverwrite) {
        writePersistedSession(null)
      }
      return result.error
    }

    const role = (storedUser.role || result.data?.role) as AuthRole
    const resolvedName = storedUser.name || result.data?.name || ''
    setAuth(role)
    setUserName(resolvedName)
    setReturnToPage(null)

    if (!options?.skipPersistOverwrite) {
      writePersistedSession({
        email: emailLower,
        password,
        name: resolvedName,
        role,
      })
    }

    if (result.data?.profile) {
      setProfileData({
        ...result.data.profile,
        name: resolvedName || result.data.profile.name,
        companyName:
          role === 'employer'
            ? resolvedName || result.data.profile.companyName
            : result.data.profile.companyName,
      })
    }

    const sessionResult = await getMarketplaceSessionAction()
    if (sessionResult.ok && sessionResult.data) {
      setApplications(sessionResult.data.applications)
      setSavedJobs(sessionResult.data.savedJobs)
      setNotifications(sessionResult.data.notifications)
      setEmployerJobs(sessionResult.data.employerJobs)
      setAdminUsers(sessionResult.data.adminUsers)
      setAdminJobs(sessionResult.data.adminJobs)
      setAdminReviews(sessionResult.data.adminReviews)
      if (sessionResult.data.profile) {
        const finalName = resolvedName || sessionResult.data.profile.name || ''
        setProfileData({
          ...sessionResult.data.profile,
          name: finalName,
          companyName:
            role === 'employer'
              ? finalName || sessionResult.data.profile.companyName
              : sessionResult.data.profile.companyName,
        })
        setUserName(finalName)
      }

      if (sessionResult.data.approvedJobs) {
        setJobs((currentJobs) => {
          const dynamicIds = new Set(
            (sessionResult.data.employerJobs || []).map((j: EmployerJobRow) => j.id),
          )
          const staticSeedJobs = currentJobs.filter((j) => !dynamicIds.has(j.id))
          return [...sessionResult.data.approvedJobs, ...staticSeedJobs]
        })
      }
    }

    const defaultRolePage: Page =
      role === 'employer' ? 'employer' : role === 'admin' ? 'admin' : 'jobs'
    const targetPage: Page =
      options?.restoredPage && canAccessPage(options.restoredPage, role)
        ? options.restoredPage
        : defaultRolePage
    setPage(targetPage)
    writePersistedPage(targetPage)
    return null
  }

  const logout = async () => {
    await logoutAction()
    writePersistedSession(null)
    setAuth('guest')
    setPage('jobs')
    setReturnToPage(null)
    setUserName('')
    setViewingApplication(null)
    setApplications([])
    setSavedJobs([])
    setNotifications([])
    setEmployerJobs([])
    setAdminUsers([])
    setAdminJobs([])
    setAdminReviews([])
    router.refresh()
  }

  const activeApplication = viewingApplication
    ? applications.find((item) => item.id === viewingApplication.id) ?? viewingApplication
    : null

  return (
    <div className="app">
      <Header
        page={page}
        auth={auth}
        go={go}
        logout={logout}
        notifications={notifications}
        onSelectNotification={handleSelectNotification}
        onMarkAllRead={handleMarkAllNotificationsRead}
      />
      {page === 'jobs' && (
        <FindJobs
          jobs={jobs}
          go={go}
          selectJob={(job) => {
            setViewingApplication(null)
            setSelectedJob(job)
          }}
          savedJobs={savedJobs}
          toggleSaved={toggleSaved}
          canSave={auth === 'student'}
          auth={auth}
          hasCV={Boolean(profileData.defaultCvName || profileData.defaultCvUrl)}
          cvName={profileData.defaultCvName}
        />
      )}
      {page === 'detail' && (selectedJob || activeApplication) && (
        <JobDetail
          job={
            selectedJob ?? {
              id: activeApplication!.jobId,
              company: activeApplication!.company,
              title: activeApplication!.title,
              pay: activeApplication!.pay,
              hourlyRate: 30,
              place: activeApplication!.place,
              schedule: activeApplication!.schedule,
              category: 'Đa ngành nghề',
              posted: activeApplication!.date,
              description:
                'Chi tiết ca làm và công việc cụ thể được nhà tuyển dụng cập nhật theo từng đợt tuyển.',
            }
          }
          application={activeApplication}
          auth={auth}
          userName={userName}
          profileCompleted={Boolean(profileData.isProfileCompleted)}
          defaultCv={
            profileData.defaultCvName || profileData.defaultCvUrl
              ? {
                  name: profileData.defaultCvName || 'HoSo_SinhVien',
                  url: profileData.defaultCvUrl || '',
                }
              : null
          }
          defaultIntro={profileData.bio}
          go={go}
          onRequestUpdateProfile={() => {
            setReturnToPage('detail')
            setPage('profile')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          setApplications={setApplications}
          setEmployerJobs={setEmployerJobs}
          onStudentReviewSubmitted={() => syncDataFromSession()}
        />
      )}
      {page === 'applications' && (
        <Applications
          go={go}
          applications={applications}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onViewApplication={(appItem) => {
            setViewingApplication(appItem)
            setSelectedJob(null)
          }}
        />
      )}
      {page === 'saved' && (
        <Saved
          jobs={jobs}
          savedJobs={savedJobs}
          go={go}
          removeSaved={async (savedId) => {
            const result = await unsaveJobAction(savedId)
            if (result.ok) {
              setSavedJobs((current) => current.filter((item) => item.id !== savedId))
            }
          }}
          selectJob={(job) => {
            setViewingApplication(null)
            setSelectedJob(job)
          }}
        />
      )}
      {page === 'profile' && (
        <ProfilePage
          auth={auth}
          profile={profileData}
          returnToPage={returnToPage}
          onSaveProfile={async (updated) => {
            setProfileData(updated)
            setUserName(updated.name)
            try {
              const savedSession = readPersistedSession()
              if (savedSession) {
                writePersistedSession({
                  ...savedSession,
                  name: updated.name,
                })
              }
            } catch {
              // ignore
            }
            await syncDataFromSession(false)
          }}
          go={go}
        />
      )}
      {page === 'employer' && (
        <EmployerDashboard
          go={go}
          jobs={employerJobs}
          applications={applications}
          userName={userName}
          onToggleJobStatus={handleToggleEmployerJobStatus}
        />
      )}
      {page === 'post-job' && (
        <PostJob
          go={go}
          companyName={profileData.companyName || userName}
          defaultLocation={profileData.companyArea}
          defaultAddress={profileData.companyAddress}
          onJobCreated={() => syncDataFromSession()}
        />
      )}
      {page === 'candidates' && (
        <Candidates
          applications={applications}
          setApplications={setApplications}
          setEmployerJobs={setEmployerJobs}
          employerName={profileData.companyName || userName}
          onActionCompleted={() => syncDataFromSession()}
        />
      )}
      {page === 'signup' && (
        <Signup
          go={go}
          onVerificationCreated={(data) => {
            setPendingVerification(data)
          }}
        />
      )}
      {page === 'verify-email' && (
        <VerifyEmail
          pending={pendingVerification}
          onUpdatePending={(data) => setPendingVerification(data)}
          go={go}
        />
      )}
      {page === 'forgot-password' && <ForgotPassword go={go} />}
      {page === 'login' && (
        <Login
          onLogin={login}
          go={go}
          hasPendingVerification={Boolean(pendingVerification)}
        />
      )}
      {page.startsWith('admin') && (
        <Admin
          section={page}
          initialUsers={adminUsers}
          initialJobs={adminJobs}
          initialReviews={adminReviews}
          refreshJobs={() => syncDataFromSession()}
        />
      )}
      {page !== 'signup' &&
        page !== 'login' &&
        page !== 'verify-email' &&
        page !== 'forgot-password' && <Footer go={go} />}
    </div>
  )
}