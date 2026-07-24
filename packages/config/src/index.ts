export const DEFAULT_TIME_ZONE = "Europe/Istanbul" as const;
export const DEFAULT_API_PORT = 3001;
export const ATTENDANCE_TOKEN_TTL_MINUTES = 15;
export const QR_ATTENDANCE_TOKEN_TTL_SECONDS = 90;
export const ATTENDANCE_CHECK_IN_OPENS_MINUTES_BEFORE_START = 30;
export const ATTENDANCE_CHECK_IN_CLOSES_MINUTES_AFTER_END = 30;
export const DEFAULT_QR_ATTENDANCE_SECRET = "dev-qr-attendance-secret-change-in-production";
export const DEFAULT_EMAIL_OTP_SECRET = "dev-email-otp-secret-change-in-production";

export const EMAIL_OTP_TTL_MINUTES = 10;
export const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
export const EMAIL_OTP_MAX_FAILED_ATTEMPTS = 5;

export function getApiBaseUrl(): string {
  const runtime = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtime.process?.env?.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}

export function getQrAttendanceSecret(): string {
  const runtime = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtime.process?.env?.QR_ATTENDANCE_SECRET ?? DEFAULT_QR_ATTENDANCE_SECRET;
}

export function getEmailOtpSecret(): string {
  const runtime = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtime.process?.env?.EMAIL_OTP_SECRET ?? DEFAULT_EMAIL_OTP_SECRET;
}
