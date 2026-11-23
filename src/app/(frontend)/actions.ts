'use server';

import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';
import { sql } from '../../lib/db';

type ActionResult<T = undefined> =
  | { ok: true; data?: T; error?: string; fields?: Record<string, string> }
  | { ok: false; error: string; fields?: Record<string, string> };

export type PendingModerationJob = {
  id: string;
  title: string;
  company: string;
  pay: string;
  hourlyRate: number;
  place: string;
  schedule: string;
  category: string;
  posted: string;
  description: string;
  requirements: string;
  openings: number;
  status: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối';
};

export type ReviewData = {
  id?: string;
  rating: number;
  comment: string;
  date: string;
  reviewerName: string;
  moderationStatus?: 'pending' | 'approved' | 'hidden';
};

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  date: string;
  targetPage?: 'applications' | 'candidates' | 'employer' | 'post-job' | 'jobs';
};

export type VerificationPendingData = {
  email: string;
  code: string;
  expiresAt: number;
  sentViaEmail: boolean;
  previewHint: string;
};

export type UserProfileData = {
  name: string;
  email: string;
  role: 'student' | 'employer' | 'admin';
  phone: string;
  school: string;
  major: string;
  bio: string;
  defaultCvName: string;
  defaultCvUrl: string;
  companyName: string;
  companyArea: string;
  companyAddress: string;
  companyDescription: string;
  isProfileCompleted?: boolean;
  emailVerified?: boolean;
};

const SESSION_COOKIE_NAME = 'shiftly_user_email';
const DEFAULT_SESSION_EMAIL = 'vinh@vanlang.edu.vn';
const DEMO_STUDENT_EMAILS = ['vinh@vanlang.edu.vn', 'sv@gmail.com'];
const DEMO_EMPLOYER_EMAILS = ['hr@doitac.vn', 'ntd@gmail.com'];

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
  ).toString('base64');

function mapUserRowToProfile(row: Record<string, any>): UserProfileData {
  const defaultCvName = row.default_cv_name || '';
  const defaultCvUrl =
    row.default_cv_url ||
    (defaultCvName === 'CV_NguyenVanVinh.pdf' ? SAMPLE_CV_PDF_DATA_URL : '');

  return {
    name: row.name,
    email: row.email,
    role: row.role as 'student' | 'employer' | 'admin',
    phone: row.phone || '',
    school: row.school || '',
    major: row.major || '',
    bio: row.bio || '',
    defaultCvName,
    defaultCvUrl,
    companyName: row.company_name || '',
    companyArea: row.company_area || 'Quận 1',
    companyAddress: row.company_address || '',
    companyDescription: row.company_description || '',
    isProfileCompleted: Boolean(row.is_profile_completed),
    emailVerified: Boolean(row.email_verified),
  };
}

async function getCurrentSessionUser(): Promise<UserProfileData> {
  const cookieStore = await cookies();
  const savedEmail = cookieStore.get(SESSION_COOKIE_NAME)?.value?.trim().toLowerCase();
  const targetEmail = savedEmail || DEFAULT_SESSION_EMAIL;

  const rows = await sql`
    SELECT * FROM users WHERE LOWER(email) = ${targetEmail} LIMIT 1
  `;
  if (rows.length > 0) {
    return mapUserRowToProfile(rows[0]);
  }

  const fallbackRows = await sql`
    SELECT * FROM users ORDER BY created_at ASC LIMIT 1
  `;
  if (fallbackRows.length > 0) {
    return mapUserRowToProfile(fallbackRows[0]);
  }

  return {
    role: 'student',
    name: 'Nguyễn Văn Vinh',
    email: DEFAULT_SESSION_EMAIL,
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
    isProfileCompleted: false,
    emailVerified: true,
  };
}

async function dispatchVerificationEmail(
  email: string,
  name: string,
  code: string,
  purpose: 'signup' | 'reset-password' = 'signup',
): Promise<{ sent: boolean; error?: string }> {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '').trim();

  if (!gmailUser || !gmailAppPassword) {
    console.warn('[SHIFTLY] Thiếu GMAIL_USER hoặc GMAIL_APP_PASSWORD trong biến môi trường');
    return {
      sent: false,
      error:
        'Chưa cấu hình GMAIL_USER và GMAIL_APP_PASSWORD trong biến môi trường (Vercel / .env).',
    };
  }

  const isReset = purpose === 'reset-password';
  const subject = isReset
    ? `[Shiftly] Mã OTP đặt lại mật khẩu của bạn là ${code}`
    : `[Shiftly] Mã xác thực OTP của bạn là ${code}`;
  const heading = isReset ? 'Khôi phục mật khẩu - Shiftly' : 'Xác thực tài khoản email - Shiftly';
  const introText = isReset
    ? 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>Shiftly</strong> của bạn. Vui lòng nhập mã OTP 6 chữ số bên dưới để tạo mật khẩu mới:'
    : 'Cảm ơn bạn đã đăng ký tài khoản trên <strong>Shiftly</strong>. Vui lòng nhập mã OTP 6 chữ số bên dưới để hoàn tất xác thực:';

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

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
    });

    return { sent: true };
  } catch (err) {
    console.error('[SHIFTLY GMAIL SMTP ERROR]', err);
    return {
      sent: false,
      error:
        'Không thể gửi email qua Gmail SMTP. Kiểm tra lại GMAIL_USER và App Password trên Vercel / .env.',
    };
  }
}

async function pushNotification(
  targetEmail: string,
  payload: Omit<NotificationItem, 'id' | 'read' | 'date'>,
) {
  const key = targetEmail.trim().toLowerCase();
  if (!key) return;
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    INSERT INTO notifications (id, recipient_email, title, message, is_read, target_page, date_label)
    VALUES (${id}, ${key}, ${payload.title}, ${payload.message}, FALSE, ${payload.targetPage || 'jobs'}, 'Vừa xong')
  `;
}

async function pushNotificationToEmployers(
  employerEmail: string | undefined,
  companyName: string | undefined,
  payload: Omit<NotificationItem, 'id' | 'read' | 'date'>,
) {
  const recipients = new Set<string>(DEMO_EMPLOYER_EMAILS);
  if (employerEmail) recipients.add(employerEmail.trim().toLowerCase());

  const employers = await sql`
    SELECT email, name, company_name FROM users WHERE role = 'employer'
  `;

  for (const emp of employers) {
    const empEmail = String(emp.email || '').toLowerCase();
    const empName = String(emp.name || '').toLowerCase();
    const empCompany = String(emp.company_name || '').toLowerCase();
    const targetCompany = (companyName || '').toLowerCase();

    if (
      !targetCompany ||
      empCompany === targetCompany ||
      empName === targetCompany ||
      empEmail === employerEmail?.toLowerCase()
    ) {
      recipients.add(empEmail);
    }
  }

  for (const email of recipients) {
    await pushNotification(email, payload);
  }
}

export async function loginAction(input: {
  email: string;
  password: string;
  fallbackName?: string;
}): Promise<ActionResult<{ role: string; name: string; profile: UserProfileData }>> {
  if (!input.email || !input.password) {
    return { ok: false, error: 'Vui lòng nhập email và mật khẩu.' };
  }

  const emailLower = input.email.trim().toLowerCase();
  const rows = await sql`
    SELECT * FROM users WHERE LOWER(email) = ${emailLower} LIMIT 1
  `;

  if (rows.length === 0) {
    return {
      ok: false,
      error: 'Tài khoản này chưa được đăng ký. Vui lòng chọn "Đăng ký ngay" để tạo tài khoản.',
    };
  }

  const userRow = rows[0];

  if (userRow.password_hash !== input.password) {
    return { ok: false, error: 'Mật khẩu không chính xác.' };
  }

  if (userRow.active === false) {
    return { ok: false, error: 'Tài khoản này đã bị khóa bởi quản trị viên.' };
  }

  if (userRow.email_verified === false) {
    return {
      ok: false,
      error:
        'Email này chưa được xác thực. Vui lòng nhập mã xác thực gửi về email của bạn trước khi đăng nhập.',
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, emailLower, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  const profile = mapUserRowToProfile(userRow);
  return {
    ok: true,
    data: {
      role: profile.role,
      name: profile.name,
      profile,
    },
  };
}

export async function logoutAction(): Promise<ActionResult> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return { ok: true };
}

export async function getMarketplaceSessionAction(): Promise<ActionResult<any>> {
  const currentUser = await getCurrentSessionUser();
  const emailLower = currentUser.email.toLowerCase();

  const [jobRows, appRows, savedRows, notifRows, userRows, reviewRows] = await Promise.all([
    sql`SELECT * FROM jobs ORDER BY created_at DESC`,
    currentUser.role === 'student'
      ? DEMO_STUDENT_EMAILS.includes(emailLower)
        ? sql`SELECT * FROM applications WHERE LOWER(student_email) IN ('vinh@vanlang.edu.vn', 'sv@gmail.com') ORDER BY created_at DESC`
        : sql`SELECT * FROM applications WHERE LOWER(student_email) = ${emailLower} ORDER BY created_at DESC`
      : sql`SELECT * FROM applications ORDER BY created_at DESC`,
    sql`SELECT id, job_id FROM saved_jobs WHERE LOWER(student_email) = ${emailLower} ORDER BY created_at DESC`,
    sql`SELECT * FROM notifications WHERE LOWER(recipient_email) = ${emailLower} ORDER BY created_at DESC`,
    sql`SELECT id, name, email, role, active FROM users ORDER BY created_at DESC`,
    sql`SELECT * FROM reviews ORDER BY created_at DESC`,
  ]);

  const reviewsByAppId: Record<
    string,
    { employerReview?: ReviewData; studentReview?: ReviewData }
  > = {};

  for (const r of reviewRows) {
    if (!r.application_id) continue;
    if (!reviewsByAppId[r.application_id]) {
      reviewsByAppId[r.application_id] = {};
    }
    const mappedReview: ReviewData = {
      id: r.id,
      rating: Number(r.rating),
      comment: r.content || '',
      date: r.review_date_label || 'Hôm nay',
      reviewerName: r.author_name,
      moderationStatus: r.moderation_status as 'pending' | 'approved' | 'hidden',
    };
    if (r.review_type === 'employer-to-student') {
      reviewsByAppId[r.application_id].employerReview = mappedReview;
    } else if (r.review_type === 'student-to-employer') {
      reviewsByAppId[r.application_id].studentReview = mappedReview;
    }
  }

  const employerJobs = jobRows.map((j) => ({
    id: j.id,
    company: j.company,
    employerEmail: j.employer_email,
    title: j.title,
    pay: j.pay,
    hourlyRate: Number(j.hourly_rate || 30),
    place: j.place,
    schedule: j.schedule,
    category: j.category,
    posted: j.posted_label || 'Hôm nay',
    description: j.description || '',
    requirements: j.requirements || '',
    status: j.status as 'recruiting' | 'paused' | 'filled' | 'completed',
    moderationStatus: j.moderation_status as 'pending' | 'approved' | 'rejected',
    openings: Number(j.openings || 1),
    applicationCount: Number(j.application_count || 0),
  }));

  const approvedJobs = employerJobs
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
    }));

  const pendingModerationJobs: PendingModerationJob[] = employerJobs
    .filter((j) => j.moderationStatus === 'pending')
    .map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      pay: j.pay,
      hourlyRate: j.hourlyRate,
      place: j.place,
      schedule: j.schedule,
      category: j.category,
      posted: j.posted,
      description: j.description,
      requirements: j.requirements,
      openings: j.openings,
      status: 'Chờ duyệt',
    }));

  const applications = appRows.map((a) => {
    const cvName = a.cv_name || '';
    const cvUrl =
      a.cv_url || (cvName === 'CV_NguyenVanVinh.pdf' ? SAMPLE_CV_PDF_DATA_URL : undefined);
    const linkedReviews = reviewsByAppId[a.id] || {};

    return {
      id: a.id,
      jobId: a.job_id,
      title: a.job_title,
      company: a.company_name,
      employerEmail: a.employer_email,
      date: a.applied_date_label || 'Hôm nay',
      status: a.status as 'pending' | 'hired' | 'rejected' | 'completed',
      studentEmail: a.student_email,
      studentName: a.student_name,
      studentSchool: a.student_school || 'Sinh viên ứng tuyển',
      introduction: a.introduction || '',
      pay: a.pay,
      place: a.place,
      schedule: a.schedule,
      openings: 1,
      hasCV: Boolean(a.has_cv),
      cvName,
      cvUrl,
      employerReview: linkedReviews.employerReview,
      studentReview: linkedReviews.studentReview,
    };
  });

  const savedJobs = savedRows.map((s) => ({
    id: s.id,
    jobId: s.job_id,
  }));

  const notifications: NotificationItem[] =
    notifRows.length > 0
      ? notifRows.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          read: Boolean(n.is_read),
          date: n.date_label || 'Hôm nay',
          targetPage: n.target_page || 'jobs',
        }))
      : [
          {
            id: `notif-welcome-${Date.now()}`,
            title: 'Chào mừng bạn đến với shiftly',
            message: 'Hãy cập nhật hồ sơ cá nhân để bắt đầu sử dụng đầy đủ tính năng.',
            read: false,
            date: 'Hôm nay',
            targetPage: currentUser.role === 'employer' ? 'employer' : 'jobs',
          },
        ];

  const adminUsers = userRows
    .filter((u) => u.role !== 'admin')
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as 'student' | 'employer' | 'admin',
      active: Boolean(u.active),
    }));

  const adminReviews = reviewRows.map((r) => ({
    id: r.id,
    applicationId: r.application_id || undefined,
    reviewType: r.review_type as 'employer-to-student' | 'student-to-employer',
    author: r.author_name,
    target: r.target_name,
    rating: Number(r.rating),
    content: r.content || '',
    status:
      r.moderation_status === 'approved'
        ? 'Đang hiển thị'
        : r.moderation_status === 'hidden'
          ? 'Đã ẩn'
          : 'Chờ duyệt',
  }));

  return {
    ok: true,
    data: {
      role: currentUser.role,
      name: currentUser.name,
      profile: currentUser,
      applications,
      savedJobs,
      notifications,
      employerJobs,
      adminUsers,
      adminJobs: pendingModerationJobs,
      adminReviews,
      approvedJobs,
    },
  };
}

export async function updateProfileAction(
  input: Partial<UserProfileData>,
): Promise<ActionResult<UserProfileData>> {
  const currentUser = await getCurrentSessionUser();
  const emailLower = (input.email ?? currentUser.email).trim().toLowerCase();
  const nextName = (
    currentUser.role === 'employer' && input.companyName?.trim()
      ? input.companyName.trim()
      : input.name?.trim() || currentUser.name
  ).trim();

  const updated: UserProfileData = {
    ...currentUser,
    ...input,
    name: nextName,
    email: emailLower,
    companyName: (input.companyName ?? currentUser.companyName).trim(),
    isProfileCompleted: true,
  };

  await sql`
    UPDATE users
    SET
      name = ${updated.name},
      phone = ${updated.phone},
      school = ${updated.school},
      major = ${updated.major},
      bio = ${updated.bio},
      default_cv_name = ${updated.defaultCvName},
      default_cv_url = ${updated.defaultCvUrl},
      company_name = ${updated.companyName},
      company_area = ${updated.companyArea},
      company_address = ${updated.companyAddress},
      company_description = ${updated.companyDescription},
      is_profile_completed = TRUE,
      updated_at = CURRENT_TIMESTAMP
    WHERE LOWER(email) = ${emailLower}
  `;

  await pushNotification(emailLower, {
    title: 'Đã cập nhật hồ sơ cá nhân',
    message: 'Thông tin hồ sơ của bạn đã được lưu và đồng bộ thành công.',
    targetPage: currentUser.role === 'employer' ? 'employer' : 'jobs',
  });

  return { ok: true, data: updated };
}

export async function signupAction(input: {
  name: string;
  email: string;
  password: string;
  role: string;
  school?: string;
  major?: string;
  companyName?: string;
}): Promise<ActionResult<VerificationPendingData>> {
  if (!input.name?.trim() || !input.email?.trim() || !input.password) {
    return { ok: false, error: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu.' };
  }
  const emailLower = input.email.trim().toLowerCase();
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower);
  if (!isValidEmail) {
    return { ok: false, error: 'Vui lòng nhập địa chỉ email hợp lệ để nhận mã xác thực.' };
  }

  const role: 'student' | 'employer' = input.role === 'employer' ? 'employer' : 'student';
  const cleanName = input.name.trim();
  const displayName =
    role === 'employer' && input.companyName?.trim() ? input.companyName.trim() : cleanName;
  const companyNameValue = role === 'employer' ? input.companyName?.trim() || cleanName : '';

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const mailResult = await dispatchVerificationEmail(emailLower, displayName, code, 'signup');
  if (!mailResult.sent) {
    return { ok: false, error: mailResult.error || 'Gửi mã OTP về email thất bại.' };
  }

  const existingUsers = await sql`
    SELECT id FROM users WHERE LOWER(email) = ${emailLower} LIMIT 1
  `;

  if (existingUsers.length > 0) {
    await sql`
      UPDATE users
      SET
        password_hash = ${input.password},
        role = ${role},
        name = ${displayName},
        company_name = ${companyNameValue},
        email_verified = FALSE,
        active = TRUE,
        updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(email) = ${emailLower}
    `;
  } else {
    const newUserId = `usr-${Date.now()}`;
    await sql`
      INSERT INTO users (
        id, email, password_hash, role, name, company_name,
        company_area, is_profile_completed, email_verified, active
      )
      VALUES (
        ${newUserId}, ${emailLower}, ${input.password}, ${role}, ${displayName}, ${companyNameValue},
        'Quận 1', FALSE, FALSE, TRUE
      )
    `;
  }

  await sql`
    INSERT INTO email_verifications (email, otp_code, expires_at)
    VALUES (${emailLower}, ${code}, NOW() + INTERVAL '15 minutes')
    ON CONFLICT (email) DO UPDATE
    SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, created_at = CURRENT_TIMESTAMP
  `;

  await sql`
    INSERT INTO notifications (id, recipient_email, title, message, is_read, target_page, date_label)
    VALUES (
      ${`notif-welcome-${Date.now()}`},
      ${emailLower},
      'Chào mừng bạn đến với shiftly',
      ${
        role === 'employer'
          ? 'Hãy hoàn thiện hồ sơ doanh nghiệp và đăng tin tuyển dụng đầu tiên.'
          : 'Hãy cập nhật hồ sơ cá nhân để bắt đầu ứng tuyển công việc phù hợp lịch học.'
      },
      FALSE,
      ${role === 'employer' ? 'post-job' : 'jobs'},
      'Hôm nay'
    )
  `;

  const verificationData: VerificationPendingData = {
    email: emailLower,
    code,
    expiresAt: Date.now() + 15 * 60 * 1000,
    sentViaEmail: true,
    previewHint: `Mã xác thực OTP 6 chữ số đã được gửi tới hộp thư ${emailLower}. Vui lòng kiểm tra hộp thư đến (cả mục Quảng cáo / Spam) để lấy mã.`,
  };

  return { ok: true, data: verificationData };
}

export async function verifyEmailCodeAction(input: {
  email: string;
  code: string;
}): Promise<ActionResult> {
  const emailLower = input.email.trim().toLowerCase();
  const cleanCode = input.code.trim();

  const rows = await sql`
    SELECT otp_code, (expires_at > NOW()) AS is_valid
    FROM email_verifications
    WHERE LOWER(email) = ${emailLower}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return { ok: false, error: 'Không tìm thấy yêu cầu xác thực cho email này.' };
  }
  if (!rows[0].is_valid) {
    return { ok: false, error: 'Mã xác thực đã hết hạn. Vui lòng bấm Gửi lại mã.' };
  }
  if (rows[0].otp_code !== cleanCode) {
    return { ok: false, error: 'Mã xác thực chưa chính xác. Vui lòng kiểm tra lại.' };
  }

  await sql`
    UPDATE users SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP
    WHERE LOWER(email) = ${emailLower}
  `;
  await sql`
    DELETE FROM email_verifications WHERE LOWER(email) = ${emailLower}
  `;

  return { ok: true };
}

export async function resendVerificationCodeAction(
  email: string,
): Promise<ActionResult<VerificationPendingData>> {
  const emailLower = email.trim().toLowerCase();
  const users = await sql`
    SELECT name FROM users WHERE LOWER(email) = ${emailLower} LIMIT 1
  `;

  if (users.length === 0) {
    return { ok: false, error: 'Không tìm thấy tài khoản tương ứng với email này.' };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const mailResult = await dispatchVerificationEmail(emailLower, users[0].name, code, 'signup');
  if (!mailResult.sent) {
    return { ok: false, error: mailResult.error || 'Không thể gửi lại mã OTP về email.' };
  }

  await sql`
    INSERT INTO email_verifications (email, otp_code, expires_at)
    VALUES (${emailLower}, ${code}, NOW() + INTERVAL '15 minutes')
    ON CONFLICT (email) DO UPDATE
    SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, created_at = CURRENT_TIMESTAMP
  `;

  const verificationData: VerificationPendingData = {
    email: emailLower,
    code,
    expiresAt: Date.now() + 15 * 60 * 1000,
    sentViaEmail: true,
    previewHint: `Đã gửi lại mã xác thực OTP mới tới hộp thư ${emailLower}. Vui lòng kiểm tra hộp thư đến (cả mục Quảng cáo / Spam).`,
  };
  return { ok: true, data: verificationData };
}

export async function requestPasswordResetAction(
  email: string,
): Promise<ActionResult<VerificationPendingData>> {
  const emailLower = email.trim().toLowerCase();
  if (!emailLower) {
    return { ok: false, error: 'Vui lòng nhập địa chỉ email đã đăng ký.' };
  }

  const users = await sql`
    SELECT name FROM users WHERE LOWER(email) = ${emailLower} LIMIT 1
  `;
  if (users.length === 0) {
    return { ok: false, error: 'Không tìm thấy tài khoản nào gắn với email này.' };
  }

  const displayName = users[0].name || 'Người dùng Shiftly';
  const code = String(Math.floor(100000 + Math.random() * 900000));

  const mailResult = await dispatchVerificationEmail(
    emailLower,
    displayName,
    code,
    'reset-password',
  );
  if (!mailResult.sent) {
    return {
      ok: false,
      error: mailResult.error || 'Không thể gửi mã OTP khôi phục mật khẩu về email.',
    };
  }

  const resetKey = `reset:${emailLower}`;
  await sql`
    INSERT INTO email_verifications (email, otp_code, expires_at)
    VALUES (${resetKey}, ${code}, NOW() + INTERVAL '15 minutes')
    ON CONFLICT (email) DO UPDATE
    SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, created_at = CURRENT_TIMESTAMP
  `;

  const resetData: VerificationPendingData = {
    email: emailLower,
    code,
    expiresAt: Date.now() + 15 * 60 * 1000,
    sentViaEmail: true,
    previewHint: `Mã OTP khôi phục mật khẩu (6 chữ số) đã được gửi tới ${emailLower}. Vui lòng kiểm tra hộp thư đến (cả mục Quảng cáo / Spam).`,
  };

  return { ok: true, data: resetData };
}

export async function resetPasswordWithOtpAction(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<ActionResult> {
  const emailLower = input.email.trim().toLowerCase();
  const cleanCode = input.code.trim();

  if (!input.newPassword || input.newPassword.length < 6) {
    return { ok: false, error: 'Mật khẩu mới cần có ít nhất 6 ký tự.' };
  }

  const resetKey = `reset:${emailLower}`;
  const rows = await sql`
    SELECT otp_code, (expires_at > NOW()) AS is_valid
    FROM email_verifications
    WHERE email = ${resetKey}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return { ok: false, error: 'Không tìm thấy yêu cầu đặt lại mật khẩu cho email này.' };
  }
  if (!rows[0].is_valid) {
    return { ok: false, error: 'Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.' };
  }
  if (rows[0].otp_code !== cleanCode) {
    return { ok: false, error: 'Mã OTP không chính xác. Vui lòng kiểm tra lại.' };
  }

  await sql`
    UPDATE users
    SET password_hash = ${input.newPassword}, email_verified = TRUE, updated_at = CURRENT_TIMESTAMP
    WHERE LOWER(email) = ${emailLower}
  `;
  await sql`
    DELETE FROM email_verifications WHERE email = ${resetKey}
  `;

  return { ok: true };
}

export async function applyToJobAction(input: {
  jobId: string;
  title: string;
  company: string;
  pay: string;
  place: string;
  schedule: string;
  introduction: string;
  cvId?: string;
  cvName?: string;
  cvUrl?: string;
}): Promise<ActionResult> {
  const currentUser = await getCurrentSessionUser();
  const studentEmail = currentUser.email.toLowerCase();

  const resolvedCvName = input.cvName || currentUser.defaultCvName || '';
  const resolvedCvUrl = input.cvUrl || currentUser.defaultCvUrl || '';
  const hasCV = Boolean(input.cvId || resolvedCvName || resolvedCvUrl);

  const [studentRows, jobRows] = await Promise.all([
    sql`SELECT id FROM users WHERE LOWER(email) = ${studentEmail} LIMIT 1`,
    sql`SELECT employer_email FROM jobs WHERE id = ${input.jobId} LIMIT 1`,
  ]);

  const studentId = studentRows[0]?.id || null;
  const employerEmail = jobRows[0]?.employer_email || 'ntd@gmail.com';
  const appId = `app-${Date.now()}`;
  const jobTitle = input.title || 'Vị trí công việc ứng tuyển';
  const companyName = input.company || 'Đơn vị tuyển dụng';

  await sql`
    INSERT INTO applications (
      id, job_id, student_id, student_email, student_name, student_school,
      employer_email, job_title, company_name, pay, place, schedule,
      introduction, has_cv, cv_name, cv_url, status, applied_date_label
    )
    VALUES (
      ${appId}, ${input.jobId}, ${studentId}, ${studentEmail}, ${currentUser.name}, 'Sinh viên ứng tuyển',
      ${employerEmail}, ${jobTitle}, ${companyName}, ${input.pay || 'Thỏa thuận'},
      ${input.place || 'TP.HCM'}, ${input.schedule || 'Linh hoạt'},
      ${input.introduction || currentUser.bio || ''}, ${hasCV}, ${resolvedCvName},
      ${hasCV ? resolvedCvUrl || SAMPLE_CV_PDF_DATA_URL : ''}, 'pending', 'Hôm nay'
    )
  `;

  await sql`
    UPDATE jobs
    SET application_count = application_count + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${input.jobId}
  `;

  await pushNotification(studentEmail, {
    title: 'Đã gửi đơn ứng tuyển thành công',
    message: `Hồ sơ của bạn cho vị trí "${jobTitle}" tại ${companyName} đã được gửi tới nhà tuyển dụng.`,
    targetPage: 'applications',
  });

  await pushNotificationToEmployers(employerEmail, companyName, {
    title: `Ứng viên mới: ${currentUser.name}`,
    message: `${currentUser.name} vừa ứng tuyển vào vị trí "${jobTitle}". Nhấn để xem hồ sơ ứng viên.`,
    targetPage: 'candidates',
  });

  return { ok: true };
}

export async function uploadCVAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; name: string; url: string }>> {
  const file = formData.get('file') as File | null;
  if (!file) {
    return {
      ok: true,
      data: { id: 'cv-mock-id', name: 'CV_SinhVien.pdf', url: SAMPLE_CV_PDF_DATA_URL },
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = file.type || 'application/pdf';
  const dataUrl = `data:${mimeType};base64,${base64}`;

  return {
    ok: true,
    data: { id: `cv-${Date.now()}`, name: file.name, url: dataUrl },
  };
}

export async function saveJobAction(jobId: string): Promise<ActionResult<{ id: string }>> {
  const currentUser = await getCurrentSessionUser();
  const studentEmail = currentUser.email.toLowerCase();

  const existing = await sql`
    SELECT id FROM saved_jobs WHERE LOWER(student_email) = ${studentEmail} AND job_id = ${jobId} LIMIT 1
  `;
  if (existing.length > 0) {
    return { ok: true, data: { id: existing[0].id } };
  }

  const newId = `saved-${Date.now()}`;
  await sql`
    INSERT INTO saved_jobs (id, student_email, job_id)
    VALUES (${newId}, ${studentEmail}, ${jobId})
    ON CONFLICT (student_email, job_id) DO NOTHING
  `;
  return { ok: true, data: { id: newId } };
}

export async function unsaveJobAction(savedJobId: string): Promise<ActionResult> {
  const currentUser = await getCurrentSessionUser();
  const studentEmail = currentUser.email.toLowerCase();

  await sql`
    DELETE FROM saved_jobs
    WHERE LOWER(student_email) = ${studentEmail}
      AND (id = ${savedJobId} OR job_id = ${savedJobId})
  `;
  return { ok: true };
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  await sql`
    UPDATE notifications SET is_read = TRUE WHERE id = ${notificationId}
  `;
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const currentUser = await getCurrentSessionUser();
  await sql`
    UPDATE notifications SET is_read = TRUE WHERE LOWER(recipient_email) = ${currentUser.email.toLowerCase()}
  `;
  return { ok: true };
}

export async function createReviewAction(input: {
  applicationId: string;
  rating: number;
  comment: string;
}): Promise<ActionResult<{ reviewId: string }>> {
  const currentUser = await getCurrentSessionUser();
  const isEmployer = currentUser.role === 'employer';
  const reviewId = `rev-${Date.now()}`;

  const appRows = await sql`
    SELECT * FROM applications WHERE id = ${input.applicationId} LIMIT 1
  `;
  const app = appRows[0];

  const reviewType = isEmployer ? 'employer-to-student' : 'student-to-employer';
  const authorName = isEmployer
    ? app?.company_name || currentUser.companyName || currentUser.name
    : app?.student_name || currentUser.name;
  const targetName = isEmployer
    ? app?.student_name || 'Sinh viên'
    : app?.company_name || 'Nhà tuyển dụng';
  const moderationStatus = isEmployer ? 'approved' : 'pending';

  await sql`
    INSERT INTO reviews (
      id, application_id, review_type, author_name, target_name,
      rating, content, moderation_status, review_date_label
    )
    VALUES (
      ${reviewId}, ${input.applicationId}, ${reviewType}, ${authorName}, ${targetName},
      ${input.rating}, ${input.comment}, ${moderationStatus}, 'Hôm nay'
    )
  `;

  if (app && isEmployer) {
    await pushNotification(app.student_email, {
      title: 'Nhà tuyển dụng đã đánh giá ca làm của bạn',
      message: `${app.company_name} đã đánh giá ${input.rating} sao cho vị trí "${app.job_title}". Nhấn để xem nhận xét.`,
      targetPage: 'applications',
    });
  } else if (app && !isEmployer) {
    await pushNotification(currentUser.email, {
      title: 'Đã gửi đánh giá phản hồi',
      message: `Bạn đã gửi đánh giá ${input.rating} sao cho ${app.company_name} (đang chờ quản trị viên duyệt).`,
      targetPage: 'applications',
    });
    await pushNotificationToEmployers(app.employer_email, app.company_name, {
      title: 'Sinh viên vừa gửi đánh giá mới',
      message: `${app.student_name} đã gửi đánh giá ${input.rating} sao cho vị trí "${app.job_title}" (đang chờ kiểm duyệt).`,
      targetPage: 'employer',
    });
  }

  return { ok: true, data: { reviewId } };
}

export async function createJobAction(input: any): Promise<ActionResult<{ id: string }>> {
  const currentUser = await getCurrentSessionUser();
  const creatorEmail = currentUser.email.toLowerCase();

  const userRows = await sql`
    SELECT id FROM users WHERE LOWER(email) = ${creatorEmail} LIMIT 1
  `;
  const employerId = userRows[0]?.id || null;

  const newJobId = `job-${Date.now()}`;
  const companyName =
    input.companyName ||
    (currentUser.role === 'employer' ? currentUser.companyName : '') ||
    'Đơn vị tuyển dụng';
  const title = input.title;
  const hourlyMin = Number(input.hourlyMin || 0);
  const hourlyMax = Number(input.hourlyMax || hourlyMin);
  const payText =
    hourlyMin && hourlyMax && hourlyMin !== hourlyMax
      ? `${hourlyMin}–${hourlyMax}K / giờ`
      : `${hourlyMax || hourlyMin || 30}K / giờ`;
  const hourlyRate = (hourlyMin + hourlyMax) / 2 || 30;
  const area = input.location || currentUser.companyArea || 'TP. Hồ Chí Minh';
  const streetAddress = String(input.streetAddress || '').trim();
  const place = streetAddress ? `${streetAddress}, ${area}` : area;
  const schedule = input.schedule || 'Linh hoạt';
  const category = input.category || 'F&B / Phục vụ';
  const description = input.description || '';
  const requirements = input.requirements || '';
  const openings = Number(input.openings || 1);

  await sql`
    INSERT INTO jobs (
      id, employer_id, employer_email, company, title, pay, hourly_rate,
      place, schedule, category, description, requirements, openings,
      application_count, status, moderation_status, posted_label
    )
    VALUES (
      ${newJobId}, ${employerId}, ${creatorEmail}, ${companyName}, ${title}, ${payText}, ${hourlyRate},
      ${place}, ${schedule}, ${category}, ${description}, ${requirements}, ${openings},
      0, 'recruiting', 'pending', 'Hôm nay'
    )
  `;

  await pushNotification(creatorEmail, {
    title: 'Tin tuyển dụng đang chờ kiểm duyệt',
    message: `Tin "${title}" đã được tạo thành công và đang chờ quản trị viên phê duyệt.`,
    targetPage: 'employer',
  });

  return { ok: true, data: { id: newJobId } };
}

export async function updateEmployerJobStatusAction(input: {
  jobId: string;
  status: 'recruiting' | 'paused';
}): Promise<ActionResult> {
  const currentUser = await getCurrentSessionUser();
  const updated = await sql`
    UPDATE jobs
    SET status = ${input.status}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${input.jobId}
    RETURNING title
  `;

  if (updated.length === 0) {
    return { ok: false, error: 'Không tìm thấy công việc.' };
  }

  await pushNotification(currentUser.email, {
    title: input.status === 'paused' ? 'Đã dừng tuyển công việc' : 'Đã mở lại tuyển dụng',
    message:
      input.status === 'paused'
        ? `Tin "${updated[0].title}" đã chuyển sang trạng thái Dừng tuyển và tạm ẩn khỏi danh sách tìm việc.`
        : `Tin "${updated[0].title}" đã mở lại trạng thái Đang tuyển.`,
    targetPage: 'employer',
  });

  return { ok: true };
}

export async function updateApplicationStatusAction(input: {
  applicationId: string;
  status: 'hired' | 'rejected' | 'completed';
}): Promise<ActionResult> {
  const appRows = await sql`
    UPDATE applications
    SET status = ${input.status}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${input.applicationId}
    RETURNING *
  `;

  if (appRows.length > 0) {
    const app = appRows[0];
    if (input.status === 'hired') {
      await sql`UPDATE jobs SET status = 'filled', updated_at = CURRENT_TIMESTAMP WHERE id = ${app.job_id}`;
      await pushNotification(app.student_email, {
        title: 'Chúc mừng! Bạn đã được nhận việc',
        message: `${app.company_name} đã duyệt hồ sơ và nhận bạn vào vị trí "${app.job_title}".`,
        targetPage: 'applications',
      });
    } else if (input.status === 'rejected') {
      await pushNotification(app.student_email, {
        title: 'Cập nhật kết quả ứng tuyển',
        message: `Đơn ứng tuyển vị trí "${app.job_title}" tại ${app.company_name} chưa được chọn trong đợt này.`,
        targetPage: 'applications',
      });
    } else if (input.status === 'completed') {
      await sql`UPDATE jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ${app.job_id}`;
      await pushNotification(app.student_email, {
        title: 'Công việc đã được xác nhận hoàn thành',
        message: `${app.company_name} đã xác nhận hoàn thành ca làm "${app.job_title}". Hãy kiểm tra đánh giá và phản hồi lại.`,
        targetPage: 'applications',
      });
    }
  }

  return { ok: true };
}

export async function moderateJobAction(input: {
  jobId: string;
  status: 'approved' | 'rejected';
}): Promise<ActionResult> {
  const updated = await sql`
    UPDATE jobs
    SET moderation_status = ${input.status}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${input.jobId}
    RETURNING employer_email, company, title
  `;

  if (updated.length > 0) {
    const job = updated[0];
    await pushNotificationToEmployers(job.employer_email, job.company, {
      title:
        input.status === 'approved'
          ? 'Tin tuyển dụng đã được duyệt'
          : 'Tin tuyển dụng bị từ chối',
      message:
        input.status === 'approved'
          ? `Tin "${job.title}" đã được duyệt và hiển thị công khai cho sinh viên ứng tuyển.`
          : `Tin "${job.title}" không đạt yêu cầu kiểm duyệt. Vui lòng kiểm tra lại nội dung.`,
      targetPage: 'employer',
    });
  }

  return { ok: true };
}

export async function updateUserAction(input: any): Promise<ActionResult> {
  if (input?.userId && typeof input.active === 'boolean') {
    await sql`
      UPDATE users SET active = ${input.active}, updated_at = CURRENT_TIMESTAMP WHERE id = ${input.userId}
    `;
  }
  return { ok: true };
}

export async function createAdminAction(input: any): Promise<ActionResult<{ id: string }>> {
  return { ok: true, data: { id: 'admin-id' } };
}

export async function updateReviewAction(input: {
  reviewId: string;
  visibility?: 'hidden' | 'visible';
  action?: 'delete';
}): Promise<ActionResult> {
  const reviewRows = await sql`
    SELECT * FROM reviews WHERE id = ${input.reviewId} LIMIT 1
  `;
  if (reviewRows.length === 0) return { ok: true };

  const reviewItem = reviewRows[0];

  if (input.action === 'delete') {
    await sql`DELETE FROM reviews WHERE id = ${input.reviewId}`;
    return { ok: true };
  }

  if (input.visibility) {
    const nextModerationStatus = input.visibility === 'hidden' ? 'hidden' : 'approved';
    await sql`
      UPDATE reviews SET moderation_status = ${nextModerationStatus} WHERE id = ${input.reviewId}
    `;

    if (
      input.visibility === 'visible' &&
      reviewItem.review_type === 'student-to-employer' &&
      reviewItem.application_id
    ) {
      const appRows = await sql`
        SELECT employer_email, company_name, student_name, job_title
        FROM applications
        WHERE id = ${reviewItem.application_id}
        LIMIT 1
      `;
      if (appRows.length > 0) {
        const app = appRows[0];
        await pushNotificationToEmployers(app.employer_email, app.company_name, {
          title: 'Bạn nhận được đánh giá mới từ sinh viên',
          message: `${app.student_name} đã đánh giá ${reviewItem.rating} sao cho vị trí "${app.job_title}". Nhấn để xem.`,
          targetPage: 'employer',
        });
      }
    }
  }

  return { ok: true };
}