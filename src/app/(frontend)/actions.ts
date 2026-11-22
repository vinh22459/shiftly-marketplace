'use server'

import nodemailer from 'nodemailer'

type ActionResult<T = undefined> =
  | { ok: true; data?: T; error?: string; fields?: Record<string, string> }
  | { ok: false; error: string; fields?: Record<string, string> }

export type PendingModerationJob = {
  id: string
  title: string
  company: string
  pay: string
  hourlyRate: number
  place: string
  schedule: string
  category: string
  posted: string
  description: string
  requirements: string
  openings: number
  status: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối'
}

export type ReviewData = {
  id?: string
  rating: number
  comment: string
  date: string
  reviewerName: string
  moderationStatus?: 'pending' | 'approved' | 'hidden'
}

export type NotificationItem = {
  id: string
  title: string
  message: string
  read: boolean
  date: string
  targetPage?: 'applications' | 'candidates' | 'employer' | 'post-job' | 'jobs'
}

export type VerificationPendingData = {
  email: string
  code: string
  expiresAt: number
  sentViaEmail: boolean
  previewHint: string
}

export type UserProfileData = {
  name: string
  email: string
  role: 'student' | 'employer' | 'admin'
  phone: string
  school: string
  major: string
  bio: string
  defaultCvName: string
  defaultCvUrl: string
  companyName: string
  companyArea: string
  companyAddress: string
  companyDescription: string
  isProfileCompleted?: boolean
  emailVerified?: boolean
}

const SAMPLE_CV_PDF_DATA_URL =
  'data:application/pdf;base64,' +
  Buffer.from(
    `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 168 >> stream
BT
/F1 18 Tf
50 760 Td
(HO SO UNG VIEN - SHIFTLY) Tj
/F1 12 Tf
0 -35 Td
(Ho ten: Nguyen Van Vinh) Tj
0 -22 Td
(Vi tri ung tuyen: Nhan vien Pha che & Phuc vu) Tj
0 -22 Td
(Ky nang: Giao tiep tot, nhanh nhen, linh hoat ca lam) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 0000 n 
0000000058 0000 n 
0000000115 0000 n 
0000000241 0000 n 
0000000461 0000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
531
%%EOF`,
    'utf-8',
  ).toString('base64')

const DEMO_STUDENT_EMAILS = ['vinh@vanlang.edu.vn', 'sv@gmail.com']
const DEMO_EMPLOYER_EMAILS = ['hr@doitac.vn', 'ntd@gmail.com']
const DEMO_ACCOUNTS = ['sv@gmail.com', 'ntd@gmail.com', 'admin@gmail.com']

type EmployerJobItem = {
  id: string
  company: string
  employerEmail?: string
  title: string
  pay: string
  hourlyRate: number
  place: string
  schedule: string
  category: string
  posted: string
  description: string
  requirements: string
  status: 'recruiting' | 'paused' | 'filled' | 'completed'
  moderationStatus: 'pending' | 'approved' | 'rejected'
  openings: number
  applicationCount: number
}

type MockStore = {
  profilesByEmail: Record<string, UserProfileData>
  passwordsByEmail: Record<string, string>
  pendingVerificationsByEmail: Record<string, VerificationPendingData>
  currentUser: UserProfileData
  applications: Array<{
    id: string
    jobId: string
    title: string
    company: string
    employerEmail?: string
    date: string
    status: 'pending' | 'hired' | 'rejected' | 'completed'
    studentEmail: string
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
  }>
  savedJobsByEmail: Record<string, Array<{ id: string; jobId: string }>>
  notificationsByEmail: Record<string, Array<NotificationItem>>
  employerJobs: EmployerJobItem[]
  adminUsers: Array<{
    id: string
    name: string
    email: string
    role: 'student' | 'employer' | 'admin'
    active: boolean
  }>
  adminJobs: Array<PendingModerationJob>
  adminReviews: Array<{
    id: string
    applicationId?: string
    reviewType?: 'employer-to-student' | 'student-to-employer'
    author: string
    target: string
    rating: number
    content: string
    status: string
  }>
}

const DEFAULT_PASSWORDS: Record<string, string> = {
  'vinh@vanlang.edu.vn': '123',
  'sv@gmail.com': '123',
  'ntd@gmail.com': '123',
  'admin@gmail.com': '123',
  'hr@doitac.vn': '123',
}

const globalForShiftly = globalThis as unknown as { __shiftlyMockStore?: MockStore }

if (!globalForShiftly.__shiftlyMockStore) {
  const initialProfiles: Record<string, UserProfileData> = {
    'vinh@vanlang.edu.vn': {
      role: 'student',
      name: 'Nguyễn Văn Vinh',
      email: 'vinh@vanlang.edu.vn',
      phone: '0901 234 567',
      school: '',
      major: '',
      bio: 'Sinh viên năng động, đúng giờ, có thể làm linh hoạt các buổi sáng, chiều hoặc cuối tuần và sẵn sàng học hỏi nhanh.',
      defaultCvName: 'CV_NguyenVanVinh.pdf',
      defaultCvUrl: SAMPLE_CV_PDF_DATA_URL,
      companyName: 'Đơn vị tuyển dụng đối tác',
      companyArea: 'Quận 1',
      companyAddress: '86 Cao Thắng, Quận 1, TP.HCM',
      companyDescription:
        'Đơn vị tuyển dụng bán thời gian thân thiện, hỗ trợ sinh viên sắp xếp lịch làm linh hoạt.',
      isProfileCompleted: true,
      emailVerified: true,
    },
    'sv@gmail.com': {
      role: 'student',
      name: 'Nguyễn Văn Vinh',
      email: 'sv@gmail.com',
      phone: '0901 234 567',
      school: '',
      major: '',
      bio: 'Sinh viên năng động, đúng giờ, có thể làm linh hoạt các buổi sáng, chiều hoặc cuối tuần và sẵn sàng học hỏi nhanh.',
      defaultCvName: 'CV_NguyenVanVinh.pdf',
      defaultCvUrl: SAMPLE_CV_PDF_DATA_URL,
      companyName: 'Đơn vị tuyển dụng đối tác',
      companyArea: 'Quận 1',
      companyAddress: '86 Cao Thắng, Quận 1, TP.HCM',
      companyDescription:
        'Đơn vị tuyển dụng bán thời gian thân thiện, hỗ trợ sinh viên sắp xếp lịch làm linh hoạt.',
      isProfileCompleted: true,
      emailVerified: true,
    },
    'ntd@gmail.com': {
      role: 'employer',
      name: 'Đơn vị tuyển dụng đối tác',
      email: 'ntd@gmail.com',
      phone: '0909 123 456',
      school: '',
      major: '',
      bio: '',
      defaultCvName: '',
      defaultCvUrl: '',
      companyName: 'Đơn vị tuyển dụng đối tác',
      companyArea: 'Quận 1',
      companyAddress: '86 Cao Thắng, Quận 1, TP.HCM',
      companyDescription:
        'Đơn vị tuyển dụng bán thời gian thân thiện, hỗ trợ sinh viên sắp xếp lịch làm linh hoạt.',
      isProfileCompleted: true,
      emailVerified: true,
    },
    'admin@gmail.com': {
      role: 'admin',
      name: 'Quản trị viên hệ thống',
      email: 'admin@gmail.com',
      phone: '',
      school: '',
      major: '',
      bio: '',
      defaultCvName: '',
      defaultCvUrl: '',
      companyName: '',
      companyArea: 'Quận 1',
      companyAddress: '',
      companyDescription: '',
      isProfileCompleted: true,
      emailVerified: true,
    },
    'hr@doitac.vn': {
      role: 'employer',
      name: 'Đơn vị tuyển dụng đối tác',
      email: 'hr@doitac.vn',
      phone: '0909 123 456',
      school: '',
      major: '',
      bio: '',
      defaultCvName: '',
      defaultCvUrl: '',
      companyName: 'Đơn vị tuyển dụng đối tác',
      companyArea: 'Quận 1',
      companyAddress: '86 Cao Thắng, Quận 1, TP.HCM',
      companyDescription:
        'Đơn vị tuyển dụng bán thời gian thân thiện, hỗ trợ sinh viên sắp xếp lịch làm linh hoạt.',
      isProfileCompleted: true,
      emailVerified: true,
    },
  }

  globalForShiftly.__shiftlyMockStore = {
    profilesByEmail: initialProfiles,
    passwordsByEmail: { ...DEFAULT_PASSWORDS },
    pendingVerificationsByEmail: {},
    currentUser: { ...initialProfiles['vinh@vanlang.edu.vn'] },
    applications: [
      {
        id: 'app-1',
        jobId: 'job-1',
        title: 'Nhân viên Pha chế & Phục vụ Ca linh hoạt',
        company: 'The Coffee House - Chi nhánh Quận 1',
        employerEmail: 'ntd@gmail.com',
        date: '20/11/2026',
        status: 'pending',
        studentEmail: 'vinh@vanlang.edu.vn',
        studentName: 'Nguyễn Văn Vinh',
        studentSchool: 'Sinh viên ứng tuyển',
        introduction:
          'Em có thể làm linh hoạt các buổi sáng và cuối tuần, giao tiếp tốt, nhiệt tình và có trách nhiệm với công việc.',
        pay: '28–35K / giờ',
        place: '86 Cao Thắng, Quận 1, TP.HCM',
        schedule: 'Linh hoạt theo lịch học (20h/tuần)',
        openings: 3,
        hasCV: true,
        cvName: 'CV_NguyenVanVinh.pdf',
        cvUrl: SAMPLE_CV_PDF_DATA_URL,
      },
    ],
    savedJobsByEmail: {
      'vinh@vanlang.edu.vn': [{ id: 'saved-1', jobId: 'job-1' }],
      'sv@gmail.com': [{ id: 'saved-1', jobId: 'job-1' }],
    },
    notificationsByEmail: {
      'vinh@vanlang.edu.vn': [
        {
          id: 'notif-1',
          title: 'Chào mừng bạn đến với shiftly',
          message: 'Khám phá hàng trăm cơ hội việc làm bán thời gian đa ngành nghề phù hợp lịch học.',
          read: false,
          date: '20/11/2026',
          targetPage: 'jobs',
        },
      ],
      'sv@gmail.com': [
        {
          id: 'notif-1',
          title: 'Chào mừng bạn đến với shiftly',
          message: 'Khám phá hàng trăm cơ hội việc làm bán thời gian đa ngành nghề phù hợp lịch học.',
          read: false,
          date: '20/11/2026',
          targetPage: 'jobs',
        },
      ],
      'ntd@gmail.com': [
        {
          id: 'notif-emp-1',
          title: 'Ứng viên mới ứng tuyển',
          message: 'Nguyễn Văn Vinh vừa nộp hồ sơ cho vị trí Nhân viên Pha chế & Phục vụ Ca linh hoạt.',
          read: false,
          date: '20/11/2026',
          targetPage: 'candidates',
        },
      ],
      'hr@doitac.vn': [
        {
          id: 'notif-emp-1',
          title: 'Ứng viên mới ứng tuyển',
          message: 'Nguyễn Văn Vinh vừa nộp hồ sơ cho vị trí Nhân viên Pha chế & Phục vụ Ca linh hoạt.',
          read: false,
          date: '20/11/2026',
          targetPage: 'candidates',
        },
      ],
    },
    employerJobs: [
      {
        id: 'job-1',
        company: 'The Coffee House - Chi nhánh Quận 1',
        employerEmail: 'ntd@gmail.com',
        title: 'Nhân viên Pha chế & Phục vụ Ca linh hoạt',
        pay: '28–35K / giờ',
        hourlyRate: 32,
        place: '86 Cao Thắng, Quận 1, TP.HCM',
        schedule: 'Xoay ca linh hoạt (Sáng / Chiều / Tối)',
        category: 'F&B / Phục vụ',
        posted: '20 thg 11, 2026',
        description: 'Đón tiếp khách hàng, pha chế đồ uống theo công thức chuẩn và giữ vệ sinh quầy.',
        requirements: 'Không yêu cầu kinh nghiệm, được đào tạo bài bản, đăng ký tối thiểu 4 ca/tuần.',
        status: 'recruiting',
        moderationStatus: 'approved',
        openings: 3,
        applicationCount: 1,
      },
      {
        id: 'job-2',
        company: 'Highlands Coffee - Vincom Thủ Đức',
        employerEmail: 'ntd@gmail.com',
        title: 'Nhân viên Thu ngân & Phục vụ Bàn Part-time',
        pay: '27–33K / giờ',
        hourlyRate: 30,
        place: '216 Võ Văn Ngân, TP. Thủ Đức, TP.HCM',
        schedule: 'Ca tối 17:00–22:00 hoặc cuối tuần',
        category: 'F&B / Phục vụ',
        posted: '20 thg 11, 2026',
        description:
          'Nhận order tại quầy, phục vụ đồ uống cho khách tại bàn và hỗ trợ dọn dẹp khu vực quán.',
        requirements:
          'Nhanh nhẹn, vui vẻ, hòa đồng, ưu tiên sinh viên khu vực Làng Đại học & Thủ Đức.',
        status: 'recruiting',
        moderationStatus: 'approved',
        openings: 4,
        applicationCount: 0,
      },
      {
        id: 'job-3',
        company: 'Hệ thống Bán lẻ Circle K - Quận 7',
        employerEmail: 'ntd@gmail.com',
        title: 'Nhân viên Bán hàng & Thu ngân Cửa hàng tiện lợi',
        pay: '26–32K / giờ',
        hourlyRate: 29,
        place: '142 Nguyễn Thị Thập, Quận 7, TP.HCM',
        schedule: 'Ca chiều 14:00–22:00 hoặc xoay ca',
        category: 'Bán hàng / Thu ngân',
        posted: '20 thg 11, 2026',
        description:
          'Thanh toán hóa đơn tại quầy thu ngân, trưng bày hàng hóa lên kệ và hỗ trợ khách hàng.',
        requirements: 'Trung thực, cẩn thận, nhanh nhẹn, ưu tiên sinh viên ở khu vực Quận 7.',
        status: 'recruiting',
        moderationStatus: 'approved',
        openings: 2,
        applicationCount: 0,
      },
      {
        id: 'job-4',
        company: 'Nhà sách Phương Nam - Quận 10',
        employerEmail: 'ntd@gmail.com',
        title: 'Cộng tác viên Tư vấn Sách & Sắp xếp Quầy kệ',
        pay: '28–34K / giờ',
        hourlyRate: 31,
        place: '52 Sư Vạn Hạnh, Quận 10, TP.HCM',
        schedule: 'Sáng 8:00–12:00 hoặc Chiều 13:30–17:30',
        category: 'Bán hàng / Thu ngân',
        posted: '20 thg 11, 2026',
        description:
          'Tư vấn đầu sách cho khách hàng, kiểm kê văn phòng phẩm và giữ quầy sách gọn gàng.',
        requirements: 'Yêu thích sách, giao tiếp nhẹ nhàng, lịch sự, làm tối thiểu 4 buổi/tuần.',
        status: 'recruiting',
        moderationStatus: 'approved',
        openings: 2,
        applicationCount: 0,
      },
      {
        id: 'job-5',
        company: 'Trung tâm Anh ngữ & Kỹ năng Horizon',
        employerEmail: 'ntd@gmail.com',
        title: 'Trợ giảng Tiếng Anh Giao tiếp (Cuối tuần)',
        pay: '45–60K / giờ',
        hourlyRate: 52,
        place: '315 Điện Biên Phủ, Quận Bình Thạnh, TP.HCM',
        schedule: 'T7 & CN, 8:00–17:00',
        category: 'Gia sư / Trợ giảng',
        posted: '20 thg 11, 2026',
        description: 'Hỗ trợ giảng viên bản ngữ trên lớp, điểm danh và kèm cặp học viên thực hành.',
        requirements: 'Giao tiếp tiếng Anh khá, năng động, yêu thích môi trường giáo dục.',
        status: 'recruiting',
        moderationStatus: 'approved',
        openings: 2,
        applicationCount: 0,
      },
      {
        id: 'job-6',
        company: 'Học viện Toán Tư duy & Kỹ năng KidSmart',
        employerEmail: 'ntd@gmail.com',
        title: 'Gia sư Kèm Toán & Báo bài Tiểu học (Ca tối)',
        pay: '50–70K / giờ',
        hourlyRate: 60,
        place: '45 Nguyễn Đình Chiểu, Quận 1, TP.HCM',
        schedule: 'T2–T6, 17:30–20:30',
        category: 'Gia sư / Trợ giảng',
        posted: '20 thg 11, 2026',
        description:
          'Hướng dẫn học sinh hoàn thành bài tập trên lớp, rèn luyện tư duy logic theo giáo trình.',
        requirements: 'Kiên nhẫn, yêu trẻ nhỏ, phát âm chuẩn, điểm GPA khá trở lên.',
        status: 'recruiting',
        moderationStatus: 'approved',
        openings: 3,
        applicationCount: 0,
      },
      {
        id: 'job-7',
        company: 'Công ty Truyền thông & Sáng tạo Bloom Media',
        employerEmail: 'ntd@gmail.com',
        title: 'Cộng tác viên Content Marketing & Thiết kế Canva',
        pay: '40–55K / giờ',
        hourlyRate: 48,
        place: '18 Kha Vạn Cân, TP. Thủ Đức, TP.HCM',
        schedule: 'Linh hoạt / Hybrid (20h/tuần)',
        category: 'Marketing / Content',
        posted: '20 thg 11, 2026',
        description:
          'Lên ý tưởng bài đăng fanpage, thiết kế ấn phẩm cơ bản và hỗ trợ chiến dịch truyền thông.',
        requirements: 'Biết viết nội dung sáng tạo, sử dụng thành thạo Canva hoặc CapCut.',
        status: 'recruiting',
        moderationStatus: 'approved',
        openings: 2,
        applicationCount: 0,
      },
      {
        id: 'job-8',
        company: 'Studio Thời trang & Mỹ phẩm LUNA',
        employerEmail: 'ntd@gmail.com',
        title: 'Mẫu ảnh & Hỗ trợ Quay TikTok / Livestream Bán hàng',
        pay: '45–65K / giờ',
        hourlyRate: 55,
        place: '74 Cộng Hòa, Quận Tân Bình, TP.HCM',
        schedule: '3–4 buổi/tuần (linh hoạt theo lịch trống)',
        category: 'Marketing / Content',
        posted: '20 thg 11, 2026',
        description:
          'Tham gia quay video ngắn review sản phẩm, hỗ trợ chuẩn bị đạo cụ và tương tác livestream.',
        requirements: 'Tự tin trước ống kính, ăn nói lưu loát, bắt trend mạng xã hội tốt.',
        status: 'recruiting',
        moderationStatus: 'approved',
        openings: 2,
        applicationCount: 0,
      },
      {
        id: 'job-9',
        company: 'Trung tâm Hội nghị & Triển lãm SECC',
        employerEmail: 'ntd@gmail.com',
        title: 'Nhân viên Lễ tân & Điều phối Sự kiện Cuối tuần',
        pay: '38–50K / giờ',
        hourlyRate: 44,
        place: '799 Nguyễn Văn Linh, Quận 7, TP.HCM',
        schedule: 'Theo lịch sự kiện T6–CN (7:30–16:30)',
        category: 'Sự kiện / Lễ tân',
        posted: '20 thg 11, 2026',
        description:
          'Check-in khách mời, hướng dẫn khu vực hội thảo và hỗ trợ ban tổ chức vận hành sự kiện.',
        requirements:
          'Ngoại hình sáng, giao tiếp lịch sự, đúng giờ và chịu được áp lực công việc sự kiện.',
        status: 'recruiting',
        moderationStatus: 'approved',
        openings: 5,
        applicationCount: 0,
      },
      {
        id: 'job-10',
        company: 'Kho Phân loại & Giao vận ExpressHub',
        employerEmail: 'ntd@gmail.com',
        title: 'Cộng tác viên Phân loại & Đóng gói Đơn hàng',
        pay: '30–38K / giờ',
        hourlyRate: 34,
        place: '280 Lý Thường Kiệt, Quận 10, TP.HCM',
        schedule: 'Ca tối 18:00–22:00 hoặc sáng 7:00–11:00',
        category: 'Kho vận / Giao nhận',
        posted: '20 thg 11, 2026',
        description:
          'Quét mã vạch, phân loại bưu kiện theo tuyến quận và kiểm tra tem nhãn trước khi xuất kho.',
        requirements: 'Sức khỏe tốt, cẩn thận, thao tác nhanh, không yêu cầu kinh nghiệm.',
        status: 'recruiting',
        moderationStatus: 'approved',
        openings: 4,
        applicationCount: 0,
      },
    ],
    adminUsers: [
      {
        id: 'usr-1',
        name: 'Nguyễn Văn Vinh',
        email: 'vinh@vanlang.edu.vn',
        role: 'student',
        active: true,
      },
      {
        id: 'usr-2',
        name: 'Đơn vị tuyển dụng đối tác',
        email: 'hr@doitac.vn',
        role: 'employer',
        active: true,
      },
    ],
    adminJobs: [],
    adminReviews: [
      {
        id: 'rev-1',
        author: 'Nguyễn Văn Vinh',
        target: 'The Coffee House',
        rating: 5,
        content: 'Quản lý thân thiện, sắp xếp ca làm rất linh hoạt theo lịch thi của sinh viên.',
        status: 'Đang hiển thị',
      },
    ],
  }
}

const store = globalForShiftly.__shiftlyMockStore!
if (!store.passwordsByEmail) {
  store.passwordsByEmail = { ...DEFAULT_PASSWORDS }
}
if (!store.pendingVerificationsByEmail) {
  store.pendingVerificationsByEmail = {}
}
if (!store.profilesByEmail) {
  store.profilesByEmail = {}
}
if (!store.savedJobsByEmail) {
  store.savedJobsByEmail = {}
}
if (!store.notificationsByEmail) {
  store.notificationsByEmail = {}
}

const mockProfilesByEmail = store.profilesByEmail
const mockPasswordsByEmail = store.passwordsByEmail
const mockApplications = store.applications
const mockSavedJobsByEmail = store.savedJobsByEmail
const mockNotificationsByEmail = store.notificationsByEmail
const mockEmployerJobs = store.employerJobs
const mockAdminUsers = store.adminUsers
const mockAdminJobs = store.adminJobs
const mockAdminReviews = store.adminReviews

async function dispatchVerificationEmail(
  email: string,
  name: string,
  code: string,
  purpose: 'signup' | 'reset-password' = 'signup',
): Promise<{ sent: boolean; error?: string }> {
  const gmailUser = process.env.GMAIL_USER?.trim()
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '').trim()

  if (!gmailUser || !gmailAppPassword) {
    console.warn('[SHIFTLY] Thiếu GMAIL_USER hoặc GMAIL_APP_PASSWORD trong biến môi trường')
    return {
      sent: false,
      error:
        'Chưa cấu hình GMAIL_USER và GMAIL_APP_PASSWORD trong biến môi trường (Vercel / .env).',
    }
  }

  const isReset = purpose === 'reset-password'
  const subject = isReset
    ? `[Shiftly] Mã OTP đặt lại mật khẩu của bạn là ${code}`
    : `[Shiftly] Mã xác thực OTP của bạn là ${code}`
  const heading = isReset ? 'Khôi phục mật khẩu - Shiftly' : 'Xác thực tài khoản email - Shiftly'
  const introText = isReset
    ? 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>Shiftly</strong> của bạn. Vui lòng nhập mã OTP 6 chữ số bên dưới để tạo mật khẩu mới:'
    : 'Cảm ơn bạn đã đăng ký tài khoản trên <strong>Shiftly</strong>. Vui lòng nhập mã OTP 6 chữ số bên dưới để hoàn tất xác thực:'

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    })

    await transporter.sendMail({
      from: `"Shiftly" <${gmailUser}>`,
      to: email,
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:10px;line-height:1.6;color:#141715;">
        <h2 style="color:#114232;margin-top:0;">${heading}</h2>
        <p>Xin chào <strong>${name}</strong>,</p>
        <p>${introText}</p>
        <div style="margin:20px 0;padding:14px 20px;background:#eff6f1;border:1px dashed #114232;border-radius:8px;text-align:center;">
          <span style="font-size:28px;font-weight:800;letter-spacing:8px;color:#114232;">${code}</span>
        </div>
        <p style="font-size:13px;color:#5c6660;">Mã xác thực có hiệu lực trong <strong>15 phút</strong>. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
      </div>`,
    })

    return { sent: true }
  } catch (err) {
    console.error('[SHIFTLY GMAIL SMTP ERROR]', err)
    return {
      sent: false,
      error:
        'Không thể gửi email qua Gmail SMTP. Kiểm tra lại GMAIL_USER và App Password trên Vercel / .env.',
    }
  }
}

function pushNotification(
  targetEmail: string,
  payload: Omit<NotificationItem, 'id' | 'read' | 'date'>,
) {
  const key = targetEmail.trim().toLowerCase()
  if (!key) return
  if (!mockNotificationsByEmail[key]) {
    mockNotificationsByEmail[key] = []
  }
  mockNotificationsByEmail[key].unshift({
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: payload.title,
    message: payload.message,
    read: false,
    date: 'Vừa xong',
    targetPage: payload.targetPage,
  })
}

function pushNotificationToEmployers(
  employerEmail: string | undefined,
  companyName: string | undefined,
  payload: Omit<NotificationItem, 'id' | 'read' | 'date'>,
) {
  const recipients = new Set<string>(DEMO_EMPLOYER_EMAILS)
  if (employerEmail) recipients.add(employerEmail.trim().toLowerCase())

  for (const user of mockAdminUsers) {
    if (user.role === 'employer') {
      if (
        !companyName ||
        user.name.toLowerCase() === companyName.toLowerCase() ||
        user.email.toLowerCase() === employerEmail?.toLowerCase()
      ) {
        recipients.add(user.email.toLowerCase())
      }
    }
  }

  for (const profile of Object.values(mockProfilesByEmail)) {
    if (profile.role === 'employer') {
      if (
        !companyName ||
        profile.companyName.toLowerCase() === companyName.toLowerCase() ||
        profile.name.toLowerCase() === companyName.toLowerCase()
      ) {
        recipients.add(profile.email.toLowerCase())
      }
    }
  }

  recipients.forEach((email) => pushNotification(email, payload))
}

function getApplicationsForCurrentUser() {
  if (store.currentUser.role === 'student') {
    const emailLower = store.currentUser.email.toLowerCase()
    if (DEMO_STUDENT_EMAILS.includes(emailLower)) {
      return mockApplications.filter((a) =>
        DEMO_STUDENT_EMAILS.includes(a.studentEmail.toLowerCase()),
      )
    }
    return mockApplications.filter((a) => a.studentEmail.toLowerCase() === emailLower)
  }
  return mockApplications
}

function getSavedJobsForCurrentUser() {
  const emailLower = store.currentUser.email.toLowerCase()
  if (!mockSavedJobsByEmail[emailLower]) {
    mockSavedJobsByEmail[emailLower] = []
  }
  return mockSavedJobsByEmail[emailLower]
}

function getNotificationsForCurrentUser() {
  const emailLower = store.currentUser.email.toLowerCase()
  if (!mockNotificationsByEmail[emailLower]) {
    mockNotificationsByEmail[emailLower] = [
      {
        id: `notif-welcome-${Date.now()}`,
        title: 'Chào mừng bạn đến với shiftly',
        message: 'Hãy cập nhật hồ sơ cá nhân để bắt đầu sử dụng đầy đủ tính năng.',
        read: false,
        date: 'Hôm nay',
        targetPage: store.currentUser.role === 'employer' ? 'employer' : 'jobs',
      },
    ]
  }
  return mockNotificationsByEmail[emailLower]
}

export async function loginAction(input: {
  email: string
  password: string
  fallbackName?: string
}): Promise<ActionResult<{ role: string; name: string; profile: UserProfileData }>> {
  if (!input.email || !input.password) {
    return { ok: false, error: 'Vui lòng nhập email và mật khẩu.' }
  }

  const emailLower = input.email.trim().toLowerCase()
  const registeredUser = mockAdminUsers.find((u) => u.email.toLowerCase() === emailLower)
  const isDemoAccount = DEMO_ACCOUNTS.includes(emailLower)

  if (!registeredUser && !isDemoAccount) {
    return {
      ok: false,
      error: 'Tài khoản này chưa được đăng ký. Vui lòng chọn "Đăng ký ngay" để tạo tài khoản.',
    }
  }

  const expectedPassword = mockPasswordsByEmail?.[emailLower]
  if (expectedPassword && expectedPassword !== input.password) {
    return { ok: false, error: 'Mật khẩu không chính xác.' }
  }

  if (registeredUser && !registeredUser.active) {
    return { ok: false, error: 'Tài khoản này đã bị khóa bởi quản trị viên.' }
  }

  const existingProfile = mockProfilesByEmail[emailLower]
  if (existingProfile && existingProfile.emailVerified === false) {
    return {
      ok: false,
      error:
        'Email này chưa được xác thực. Vui lòng nhập mã xác thực gửi về email của bạn trước khi đăng nhập.',
    }
  }

  if (existingProfile) {
    store.currentUser = { ...existingProfile }
    if (registeredUser) {
      store.currentUser.role = registeredUser.role
      store.currentUser.name = registeredUser.name
    }
    return {
      ok: true,
      data: {
        role: store.currentUser.role,
        name: store.currentUser.name,
        profile: { ...store.currentUser },
      },
    }
  }

  let role: 'student' | 'employer' | 'admin' = 'student'
  let defaultName = input.fallbackName?.trim() || 'Nguyễn Văn Vinh'
  if (emailLower.includes('admin')) {
    role = 'admin'
    defaultName = 'Quản trị viên hệ thống'
  } else if (
    emailLower.includes('hr') ||
    emailLower.includes('employer') ||
    emailLower.includes('ntd')
  ) {
    role = 'employer'
    defaultName = input.fallbackName?.trim() || 'Đơn vị tuyển dụng đối tác'
  }

  const resolvedName = registeredUser?.name || defaultName

  store.currentUser = {
    role,
    name: resolvedName,
    email: emailLower,
    phone: '',
    school: '',
    major: '',
    bio: '',
    defaultCvName: '',
    defaultCvUrl: '',
    companyName: role === 'employer' ? resolvedName : '',
    companyArea: 'Quận 1',
    companyAddress: '',
    companyDescription: '',
    isProfileCompleted: role === 'admin',
    emailVerified: true,
  }
  mockProfilesByEmail[emailLower] = { ...store.currentUser }

  if (!mockSavedJobsByEmail[emailLower]) {
    mockSavedJobsByEmail[emailLower] = []
  }

  return {
    ok: true,
    data: {
      role: store.currentUser.role,
      name: store.currentUser.name,
      profile: { ...store.currentUser },
    },
  }
}

export async function logoutAction(): Promise<ActionResult> {
  return { ok: true }
}

export async function getMarketplaceSessionAction(): Promise<ActionResult<any>> {
  const approvedJobs = mockEmployerJobs
    .filter((j) => j.moderationStatus === 'approved' && j.status === 'recruiting')
    .map((j) => ({
      id: j.id,
      company: j.company,
      title: j.title,
      pay: j.pay,
      hourlyRate: j.hourlyRate,
      place: j.place,
      schedule: j.schedule,
      category: j.category,
      posted: j.posted,
      description: j.description,
    }))

  const pendingModerationJobs = mockAdminJobs.filter((j) => j.status === 'Chờ duyệt')

  return {
    ok: true,
    data: {
      role: store.currentUser.role,
      name: store.currentUser.name,
      profile: { ...store.currentUser },
      applications: getApplicationsForCurrentUser(),
      savedJobs: getSavedJobsForCurrentUser(),
      notifications: getNotificationsForCurrentUser(),
      employerJobs: mockEmployerJobs,
      adminUsers: mockAdminUsers,
      adminJobs: pendingModerationJobs,
      adminReviews: mockAdminReviews,
      approvedJobs,
    },
  }
}

export async function updateProfileAction(
  input: Partial<UserProfileData>,
): Promise<ActionResult<UserProfileData>> {
  const emailLower = (input.email ?? store.currentUser.email).trim().toLowerCase()
  const nextName = (
    store.currentUser.role === 'employer' && input.companyName?.trim()
      ? input.companyName.trim()
      : input.name?.trim() || store.currentUser.name
  ).trim()

  store.currentUser = {
    ...store.currentUser,
    ...input,
    name: nextName,
    email: emailLower,
    companyName: (input.companyName ?? store.currentUser.companyName).trim(),
    isProfileCompleted: true,
  }

  mockProfilesByEmail[emailLower] = { ...store.currentUser }

  const userIdx = mockAdminUsers.findIndex((u) => u.email.toLowerCase() === emailLower)
  if (userIdx > -1) {
    mockAdminUsers[userIdx] = {
      ...mockAdminUsers[userIdx],
      name: store.currentUser.name,
      email: store.currentUser.email,
    }
  }

  pushNotification(emailLower, {
    title: 'Đã cập nhật hồ sơ cá nhân',
    message: 'Thông tin hồ sơ của bạn đã được lưu và đồng bộ thành công.',
    targetPage: store.currentUser.role === 'employer' ? 'employer' : 'jobs',
  })

  return { ok: true, data: { ...store.currentUser } }
}

export async function signupAction(input: {
  name: string
  email: string
  password: string
  role: string
  school?: string
  major?: string
  companyName?: string
}): Promise<ActionResult<VerificationPendingData>> {
  if (!input.name?.trim() || !input.email?.trim() || !input.password) {
    return { ok: false, error: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu.' }
  }
  const emailLower = input.email.trim().toLowerCase()
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)
  if (!isValidEmail) {
    return { ok: false, error: 'Vui lòng nhập địa chỉ email hợp lệ để nhận mã xác thực.' }
  }

  const role: 'student' | 'employer' = input.role === 'employer' ? 'employer' : 'student'
  const cleanName = input.name.trim()
  const displayName =
    role === 'employer' && input.companyName?.trim() ? input.companyName.trim() : cleanName

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const mailResult = await dispatchVerificationEmail(emailLower, displayName, code, 'signup')
  if (!mailResult.sent) {
    return { ok: false, error: mailResult.error || 'Gửi mã OTP về email thất bại.' }
  }

  const freshProfile: UserProfileData = {
    role,
    name: displayName,
    email: emailLower,
    phone: '',
    school: '',
    major: '',
    bio: '',
    defaultCvName: '',
    defaultCvUrl: '',
    companyName: role === 'employer' ? input.companyName?.trim() || cleanName : '',
    companyArea: 'Quận 1',
    companyAddress: '',
    companyDescription: '',
    isProfileCompleted: false,
    emailVerified: false,
  }

  mockPasswordsByEmail[emailLower] = input.password
  mockProfilesByEmail[emailLower] = freshProfile
  mockSavedJobsByEmail[emailLower] = []
  mockNotificationsByEmail[emailLower] = [
    {
      id: `notif-welcome-${Date.now()}`,
      title: 'Chào mừng bạn đến với shiftly',
      message:
        role === 'employer'
          ? 'Hãy hoàn thiện hồ sơ doanh nghiệp và đăng tin tuyển dụng đầu tiên.'
          : 'Hãy cập nhật hồ sơ cá nhân để bắt đầu ứng tuyển công việc phù hợp lịch học.',
      read: false,
      date: 'Hôm nay',
      targetPage: role === 'employer' ? 'post-job' : 'jobs',
    },
  ]

  const existingIndex = mockAdminUsers.findIndex((u) => u.email.toLowerCase() === emailLower)
  if (existingIndex > -1) {
    mockAdminUsers[existingIndex] = {
      ...mockAdminUsers[existingIndex],
      name: displayName,
      role,
      active: true,
    }
  } else {
    mockAdminUsers.unshift({
      id: `usr-${Date.now()}`,
      name: displayName,
      email: emailLower,
      role,
      active: true,
    })
  }

  const verificationData: VerificationPendingData = {
    email: emailLower,
    code,
    expiresAt: Date.now() + 15 * 60 * 1000,
    sentViaEmail: true,
    previewHint: `Mã xác thực OTP 6 chữ số đã được gửi tới hộp thư ${emailLower}. Vui lòng kiểm tra hộp thư đến (cả mục Quảng cáo / Spam) để lấy mã.`,
  }

  store.pendingVerificationsByEmail[emailLower] = verificationData

  return { ok: true, data: verificationData }
}

export async function verifyEmailCodeAction(input: {
  email: string
  code: string
}): Promise<ActionResult> {
  const emailLower = input.email.trim().toLowerCase()
  const cleanCode = input.code.trim()
  const pending = store.pendingVerificationsByEmail?.[emailLower]

  if (!pending) {
    return { ok: false, error: 'Không tìm thấy yêu cầu xác thực cho email này.' }
  }
  if (Date.now() > pending.expiresAt) {
    return { ok: false, error: 'Mã xác thực đã hết hạn. Vui lòng bấm Gửi lại mã.' }
  }
  if (pending.code !== cleanCode) {
    return { ok: false, error: 'Mã xác thực chưa chính xác. Vui lòng kiểm tra lại.' }
  }

  if (mockProfilesByEmail[emailLower]) {
    mockProfilesByEmail[emailLower].emailVerified = true
  }
  delete store.pendingVerificationsByEmail[emailLower]

  return { ok: true }
}

export async function resendVerificationCodeAction(
  email: string,
): Promise<ActionResult<VerificationPendingData>> {
  const emailLower = email.trim().toLowerCase()
  const profile = mockProfilesByEmail[emailLower]
  if (!profile) {
    return { ok: false, error: 'Không tìm thấy tài khoản tương ứng với email này.' }
  }
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const mailResult = await dispatchVerificationEmail(emailLower, profile.name, code, 'signup')
  if (!mailResult.sent) {
    return { ok: false, error: mailResult.error || 'Không thể gửi lại mã OTP về email.' }
  }

  const verificationData: VerificationPendingData = {
    email: emailLower,
    code,
    expiresAt: Date.now() + 15 * 60 * 1000,
    sentViaEmail: true,
    previewHint: `Đã gửi lại mã xác thực OTP mới tới hộp thư ${emailLower}. Vui lòng kiểm tra hộp thư đến (cả mục Quảng cáo / Spam).`,
  }
  store.pendingVerificationsByEmail[emailLower] = verificationData
  return { ok: true, data: verificationData }
}

export async function requestPasswordResetAction(
  email: string,
): Promise<ActionResult<VerificationPendingData>> {
  const emailLower = email.trim().toLowerCase()
  if (!emailLower) {
    return { ok: false, error: 'Vui lòng nhập địa chỉ email đã đăng ký.' }
  }

  const profile = mockProfilesByEmail[emailLower]
  const registeredUser = mockAdminUsers.find((u) => u.email.toLowerCase() === emailLower)
  if (!profile && !registeredUser) {
    return { ok: false, error: 'Không tìm thấy tài khoản nào gắn với email này.' }
  }

  const displayName = profile?.name || registeredUser?.name || 'Người dùng Shiftly'
  const code = String(Math.floor(100000 + Math.random() * 900000))

  const mailResult = await dispatchVerificationEmail(
    emailLower,
    displayName,
    code,
    'reset-password',
  )
  if (!mailResult.sent) {
    return {
      ok: false,
      error: mailResult.error || 'Không thể gửi mã OTP khôi phục mật khẩu về email.',
    }
  }

  const resetData: VerificationPendingData = {
    email: emailLower,
    code,
    expiresAt: Date.now() + 15 * 60 * 1000,
    sentViaEmail: true,
    previewHint: `Mã OTP khôi phục mật khẩu (6 chữ số) đã được gửi tới ${emailLower}. Vui lòng kiểm tra hộp thư đến (cả mục Quảng cáo / Spam).`,
  }

  store.pendingVerificationsByEmail[`reset:${emailLower}`] = resetData
  return { ok: true, data: resetData }
}

export async function resetPasswordWithOtpAction(input: {
  email: string
  code: string
  newPassword: string
}): Promise<ActionResult> {
  const emailLower = input.email.trim().toLowerCase()
  const cleanCode = input.code.trim()

  if (!input.newPassword || input.newPassword.length < 6) {
    return { ok: false, error: 'Mật khẩu mới cần có ít nhất 6 ký tự.' }
  }

  const pending = store.pendingVerificationsByEmail?.[`reset:${emailLower}`]
  if (!pending) {
    return { ok: false, error: 'Không tìm thấy yêu cầu đặt lại mật khẩu cho email này.' }
  }
  if (Date.now() > pending.expiresAt) {
    return { ok: false, error: 'Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.' }
  }
  if (pending.code !== cleanCode) {
    return { ok: false, error: 'Mã OTP không chính xác. Vui lòng kiểm tra lại.' }
  }

  mockPasswordsByEmail[emailLower] = input.newPassword
  if (mockProfilesByEmail[emailLower]) {
    mockProfilesByEmail[emailLower].emailVerified = true
  }
  delete store.pendingVerificationsByEmail[`reset:${emailLower}`]

  return { ok: true }
}

export async function applyToJobAction(input: {
  jobId: string
  title: string
  company: string
  pay: string
  place: string
  schedule: string
  introduction: string
  cvId?: string
  cvName?: string
  cvUrl?: string
}): Promise<ActionResult> {
  const resolvedCvName = input.cvName || store.currentUser.defaultCvName
  const resolvedCvUrl = input.cvUrl || store.currentUser.defaultCvUrl
  const hasCV = Boolean(input.cvId || resolvedCvName || resolvedCvUrl)
  const employerJob = mockEmployerJobs.find((j) => j.id === input.jobId)

  const newApp = {
    id: `app-${Date.now()}`,
    jobId: input.jobId,
    title: input.title || 'Vị trí công việc ứng tuyển',
    company: input.company || 'Đơn vị tuyển dụng',
    employerEmail: employerJob?.employerEmail || 'ntd@gmail.com',
    date: 'Hôm nay',
    status: 'pending' as const,
    studentEmail: store.currentUser.email.toLowerCase(),
    studentName: store.currentUser.name,
    studentSchool: 'Sinh viên ứng tuyển',
    introduction: input.introduction || store.currentUser.bio,
    pay: input.pay || 'Thỏa thuận',
    place: input.place || 'TP.HCM',
    schedule: input.schedule || 'Linh hoạt',
    openings: 1,
    hasCV,
    cvName: resolvedCvName,
    cvUrl: hasCV ? resolvedCvUrl || SAMPLE_CV_PDF_DATA_URL : undefined,
  }

  mockApplications.unshift(newApp)

  if (employerJob) {
    employerJob.applicationCount = (employerJob.applicationCount || 0) + 1
  }

  pushNotification(store.currentUser.email, {
    title: 'Đã gửi đơn ứng tuyển thành công',
    message: `Hồ sơ của bạn cho vị trí "${newApp.title}" tại ${newApp.company} đã được gửi tới nhà tuyển dụng.`,
    targetPage: 'applications',
  })

  pushNotificationToEmployers(employerJob?.employerEmail, newApp.company, {
    title: `Ứng viên mới: ${store.currentUser.name}`,
    message: `${store.currentUser.name} vừa ứng tuyển vào vị trí "${newApp.title}". Nhấn để xem hồ sơ ứng viên.`,
    targetPage: 'candidates',
  })

  return { ok: true }
}

export async function uploadCVAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; name: string; url: string }>> {
  const file = formData.get('file') as File | null
  if (!file) {
    return {
      ok: true,
      data: { id: 'cv-mock-id', name: 'CV_SinhVien.pdf', url: SAMPLE_CV_PDF_DATA_URL },
    }
  }

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = file.type || 'application/pdf'
  const dataUrl = `data:${mimeType};base64,${base64}`

  return {
    ok: true,
    data: { id: `cv-${Date.now()}`, name: file.name, url: dataUrl },
  }
}

export async function saveJobAction(jobId: string): Promise<ActionResult<{ id: string }>> {
  const userSaved = getSavedJobsForCurrentUser()
  const existing = userSaved.find((s) => s.jobId === jobId)
  if (existing) {
    return { ok: true, data: { id: existing.id } }
  }
  const newSaved = { id: `saved-${Date.now()}`, jobId }
  userSaved.push(newSaved)
  return { ok: true, data: { id: newSaved.id } }
}

export async function unsaveJobAction(savedJobId: string): Promise<ActionResult> {
  const userSaved = getSavedJobsForCurrentUser()
  const index = userSaved.findIndex((s) => s.id === savedJobId || s.jobId === savedJobId)
  if (index > -1) userSaved.splice(index, 1)
  return { ok: true }
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  const userNotifs = getNotificationsForCurrentUser()
  const notif = userNotifs.find((n) => n.id === notificationId)
  if (notif) notif.read = true
  return { ok: true }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const userNotifs = getNotificationsForCurrentUser()
  userNotifs.forEach((n) => {
    n.read = true
  })
  return { ok: true }
}

export async function createReviewAction(input: {
  applicationId: string
  rating: number
  comment: string
}): Promise<ActionResult<{ reviewId: string }>> {
  const app = mockApplications.find((a) => a.id === input.applicationId)
  const isEmployer = store.currentUser.role === 'employer'
  const reviewId = `rev-${Date.now()}`

  mockAdminReviews.unshift({
    id: reviewId,
    applicationId: input.applicationId,
    reviewType: isEmployer ? 'employer-to-student' : 'student-to-employer',
    author: isEmployer
      ? app?.company || store.currentUser.companyName || store.currentUser.name
      : app?.studentName || store.currentUser.name,
    target: isEmployer ? app?.studentName || 'Sinh viên' : app?.company || 'Nhà tuyển dụng',
    rating: input.rating,
    content: input.comment,
    status: isEmployer ? 'Đang hiển thị' : 'Chờ duyệt',
  })

  if (app && isEmployer) {
    app.employerReview = {
      id: reviewId,
      rating: input.rating,
      comment: input.comment,
      date: 'Hôm nay',
      reviewerName: app.company || store.currentUser.companyName || store.currentUser.name,
      moderationStatus: 'approved',
    }
    pushNotification(app.studentEmail, {
      title: 'Nhà tuyển dụng đã đánh giá ca làm của bạn',
      message: `${app.company} đã đánh giá ${input.rating} sao cho vị trí "${app.title}". Nhấn để xem nhận xét.`,
      targetPage: 'applications',
    })
  } else if (app && !isEmployer) {
    app.studentReview = {
      id: reviewId,
      rating: input.rating,
      comment: input.comment,
      date: 'Hôm nay',
      reviewerName: app.studentName || store.currentUser.name,
      moderationStatus: 'pending',
    }
    pushNotification(store.currentUser.email, {
      title: 'Đã gửi đánh giá phản hồi',
      message: `Bạn đã gửi đánh giá ${input.rating} sao cho ${app.company} (đang chờ quản trị viên duyệt).`,
      targetPage: 'applications',
    })
    pushNotificationToEmployers(app.employerEmail, app.company, {
      title: 'Sinh viên vừa gửi đánh giá mới',
      message: `${app.studentName} đã gửi đánh giá ${input.rating} sao cho vị trí "${app.title}" (đang chờ kiểm duyệt).`,
      targetPage: 'employer',
    })
  }

  return { ok: true, data: { reviewId } }
}

export async function createJobAction(input: any): Promise<ActionResult<{ id: string }>> {
  const newJobId = `job-${Date.now()}`
  const companyName =
    input.companyName ||
    (store.currentUser.role === 'employer' ? store.currentUser.companyName : '') ||
    'Đơn vị tuyển dụng'
  const title = input.title
  const hourlyMin = Number(input.hourlyMin || 0)
  const hourlyMax = Number(input.hourlyMax || hourlyMin)
  const payText =
    hourlyMin && hourlyMax && hourlyMin !== hourlyMax
      ? `${hourlyMin}–${hourlyMax}K / giờ`
      : `${hourlyMax || hourlyMin || 30}K / giờ`
  const hourlyRate = (hourlyMin + hourlyMax) / 2 || 30
  const area = input.location || store.currentUser.companyArea || 'Quận 1'
  const streetAddress = String(input.streetAddress || '').trim()
  const place = streetAddress ? `${streetAddress}, ${area}, TP.HCM` : `${area}, TP.HCM`
  const schedule = input.schedule || 'Linh hoạt'
  const category = input.category || 'F&B / Phục vụ'
  const description = input.description || ''
  const requirements = input.requirements || ''
  const openings = Number(input.openings || 1)
  const creatorEmail = store.currentUser.email.toLowerCase()

  mockEmployerJobs.unshift({
    id: newJobId,
    company: companyName,
    employerEmail: creatorEmail,
    title,
    pay: payText,
    hourlyRate,
    place,
    schedule,
    category,
    posted: 'Hôm nay',
    description,
    requirements,
    status: 'recruiting',
    moderationStatus: 'pending',
    openings,
    applicationCount: 0,
  })

  mockAdminJobs.unshift({
    id: newJobId,
    title,
    company: companyName,
    pay: payText,
    hourlyRate,
    place,
    schedule,
    category,
    posted: 'Hôm nay',
    description,
    requirements,
    openings,
    status: 'Chờ duyệt',
  })

  pushNotification(creatorEmail, {
    title: 'Tin tuyển dụng đang chờ kiểm duyệt',
    message: `Tin "${title}" đã được tạo thành công và đang chờ quản trị viên phê duyệt.`,
    targetPage: 'employer',
  })

  return { ok: true, data: { id: newJobId } }
}

export async function updateEmployerJobStatusAction(input: {
  jobId: string
  status: 'recruiting' | 'paused'
}): Promise<ActionResult> {
  const employerJob = mockEmployerJobs.find((j) => j.id === input.jobId)
  if (!employerJob) {
    return { ok: false, error: 'Không tìm thấy công việc.' }
  }
  employerJob.status = input.status

  pushNotification(store.currentUser.email, {
    title:
      input.status === 'paused'
        ? 'Đã dừng tuyển công việc'
        : 'Đã mở lại tuyển dụng',
    message:
      input.status === 'paused'
        ? `Tin "${employerJob.title}" đã chuyển sang trạng thái Dừng tuyển và tạm ẩn khỏi danh sách tìm việc.`
        : `Tin "${employerJob.title}" đã mở lại trạng thái Đang tuyển.`,
    targetPage: 'employer',
  })

  return { ok: true }
}

export async function updateApplicationStatusAction(input: {
  applicationId: string
  status: 'hired' | 'rejected' | 'completed'
}): Promise<ActionResult> {
  const app = mockApplications.find((a) => a.id === input.applicationId)
  if (app) {
    app.status = input.status
    const employerJob = mockEmployerJobs.find((j) => j.id === app.jobId)
    if (employerJob) {
      if (input.status === 'hired') employerJob.status = 'filled'
      if (input.status === 'completed') employerJob.status = 'completed'
    }

    if (input.status === 'hired') {
      pushNotification(app.studentEmail, {
        title: 'Chúc mừng! Bạn đã được nhận việc',
        message: `${app.company} đã duyệt hồ sơ và nhận bạn vào vị trí "${app.title}".`,
        targetPage: 'applications',
      })
    } else if (input.status === 'rejected') {
      pushNotification(app.studentEmail, {
        title: 'Cập nhật kết quả ứng tuyển',
        message: `Đơn ứng tuyển vị trí "${app.title}" tại ${app.company} chưa được chọn trong đợt này.`,
        targetPage: 'applications',
      })
    } else if (input.status === 'completed') {
      pushNotification(app.studentEmail, {
        title: 'Công việc đã được xác nhận hoàn thành',
        message: `${app.company} đã xác nhận hoàn thành ca làm "${app.title}". Hãy kiểm tra đánh giá và phản hồi lại.`,
        targetPage: 'applications',
      })
    }
  }
  return { ok: true }
}

export async function moderateJobAction(input: {
  jobId: string
  status: 'approved' | 'rejected'
}): Promise<ActionResult> {
  const adminIndex = mockAdminJobs.findIndex((j) => j.id === input.jobId)
  if (adminIndex > -1) {
    mockAdminJobs.splice(adminIndex, 1)
  }

  const employerJob = mockEmployerJobs.find((j) => j.id === input.jobId)
  if (employerJob) {
    employerJob.moderationStatus = input.status
    pushNotificationToEmployers(employerJob.employerEmail, employerJob.company, {
      title:
        input.status === 'approved'
          ? 'Tin tuyển dụng đã được duyệt'
          : 'Tin tuyển dụng bị từ chối',
      message:
        input.status === 'approved'
          ? `Tin "${employerJob.title}" đã được duyệt và hiển thị công khai cho sinh viên ứng tuyển.`
          : `Tin "${employerJob.title}" không đạt yêu cầu kiểm duyệt. Vui lòng kiểm tra lại nội dung.`,
      targetPage: 'employer',
    })
  }

  return { ok: true }
}

export async function updateUserAction(input: any): Promise<ActionResult> {
  return { ok: true }
}

export async function createAdminAction(input: any): Promise<ActionResult<{ id: string }>> {
  return { ok: true, data: { id: 'admin-id' } }
}

export async function updateReviewAction(input: {
  reviewId: string
  visibility?: 'hidden' | 'visible'
  action?: 'delete'
}): Promise<ActionResult> {
  const index = mockAdminReviews.findIndex((r) => r.id === input.reviewId)
  if (index > -1) {
    const reviewItem = mockAdminReviews[index]
    const linkedApp = reviewItem.applicationId
      ? mockApplications.find((a) => a.id === reviewItem.applicationId)
      : mockApplications.find(
          (a) =>
            a.studentReview?.id === input.reviewId || a.employerReview?.id === input.reviewId,
        )

    if (input.action === 'delete') {
      mockAdminReviews.splice(index, 1)
      if (linkedApp) {
        if (
          reviewItem.reviewType === 'student-to-employer' ||
          linkedApp.studentReview?.id === input.reviewId
        ) {
          delete linkedApp.studentReview
        }
        if (
          reviewItem.reviewType === 'employer-to-student' ||
          linkedApp.employerReview?.id === input.reviewId
        ) {
          delete linkedApp.employerReview
        }
      }
    } else if (input.visibility) {
      reviewItem.status = input.visibility === 'hidden' ? 'Đã ẩn' : 'Đang hiển thị'
      if (linkedApp) {
        if (
          reviewItem.reviewType === 'student-to-employer' ||
          linkedApp.studentReview?.id === input.reviewId
        ) {
          if (linkedApp.studentReview) {
            linkedApp.studentReview.moderationStatus =
              input.visibility === 'visible' ? 'approved' : 'hidden'
          }
          if (input.visibility === 'visible') {
            pushNotificationToEmployers(linkedApp.employerEmail, linkedApp.company, {
              title: 'Bạn nhận được đánh giá mới từ sinh viên',
              message: `${linkedApp.studentName} đã đánh giá ${reviewItem.rating} sao cho vị trí "${linkedApp.title}". Nhấn để xem.`,
              targetPage: 'employer',
            })
          }
        }
        if (
          reviewItem.reviewType === 'employer-to-student' ||
          linkedApp.employerReview?.id === input.reviewId
        ) {
          if (linkedApp.employerReview) {
            linkedApp.employerReview.moderationStatus =
              input.visibility === 'visible' ? 'approved' : 'hidden'
          }
        }
      }
    }
  }
  return { ok: true }
}