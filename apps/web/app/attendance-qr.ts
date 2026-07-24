import { ATTENDANCE_TOKEN_TTL_MINUTES } from "@agu/config";
import type { AttendanceTokenResponse, AuthPrincipal } from "@agu/contracts";
import { formatEventDateTime } from "./public-events";

export type AttendanceQrPayload = {
  version: 1;
  eventId: string;
  token: string;
};

export type AttendanceQrState =
  | { kind: "checking-session" }
  | { kind: "hidden" }
  | { kind: "idle" }
  | { kind: "issuing" }
  | { kind: "ready"; tokenResponse: AttendanceTokenResponse; remainingSeconds: number }
  | { kind: "expired" }
  | { kind: "error"; message: string };

export type AttendanceQrView = {
  visible: boolean;
  message: string;
  showGenerateButton: boolean;
  buttonLabel: string;
  buttonDisabled: boolean;
  showQr: boolean;
  expiryLabel: string | null;
  remainingLabel: string | null;
};

export function canManageAttendanceQr(user: AuthPrincipal, clubId: string): boolean {
  if (user.globalRoles.includes("SYSTEM_ADMIN")) {
    return true;
  }

  return user.clubMemberships.some(
    (membership) => membership.clubId === clubId && membership.role === "ADMIN"
  );
}

export function buildAttendanceTokenPath(eventId: string): string {
  return `/events/${encodeURIComponent(eventId)}/attendance-token`;
}

export function createAttendanceQrPayload(eventId: string, token: string): string {
  const payload: AttendanceQrPayload = {
    version: 1,
    eventId,
    token
  };

  return JSON.stringify(payload);
}

export function secondsUntilExpiry(expiresAt: string, now: Date = new Date()): number {
  const expiresAtMs = new Date(expiresAt).getTime();

  if (Number.isNaN(expiresAtMs)) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiresAtMs - now.getTime()) / 1000));
}

export function formatRemainingTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes > 0) {
    return `${minutes} dakika ${seconds} saniye kaldı`;
  }

  return `${seconds} saniye kaldı`;
}

export function shouldAutoRefreshAttendanceToken(
  remainingSeconds: number,
  refreshThresholdSeconds: number = 25
): boolean {
  return remainingSeconds <= refreshThresholdSeconds;
}

export type AttendanceWindowStatus = "NOT_PUBLISHED" | "NOT_OPEN_YET" | "CLOSED" | "OPEN";

export function classifyAttendanceWindowStatus(
  startsAt: string,
  endsAt: string,
  status: string,
  now: Date = new Date()
): AttendanceWindowStatus {
  if (status !== "PUBLISHED") {
    return "NOT_PUBLISHED";
  }

  const startsAtMs = new Date(startsAt).getTime();
  const endsAtMs = new Date(endsAt).getTime();
  const nowMs = now.getTime();

  if (Number.isNaN(startsAtMs) || Number.isNaN(endsAtMs)) {
    return "CLOSED";
  }

  const windowStartMs = startsAtMs - 30 * 60 * 1000;
  const windowEndMs = endsAtMs + 30 * 60 * 1000;

  if (nowMs < windowStartMs) {
    return "NOT_OPEN_YET";
  }

  if (nowMs > windowEndMs) {
    return "CLOSED";
  }

  return "OPEN";
}

export function messageForAttendanceWindowStatus(
  windowStatus: AttendanceWindowStatus
): string | null {
  switch (windowStatus) {
    case "NOT_PUBLISHED":
      return "Yoklama QR’ı yalnızca yayınlanmış etkinlikler için oluşturulabilir.";
    case "NOT_OPEN_YET":
      return "Katılım penceresi henüz açılmadı. Etkinlik başlangıcına 30 dakika kala açılacaktır.";
    case "CLOSED":
      return "Katılım penceresi kapandı. Etkinlik bitişinden 30 dakika sonra kapanmıştır.";
    case "OPEN":
      return null;
  }
}

export function messageForAttendanceQrError(status: number): string {
  if (status === 401) {
    return "Oturumunuz sona ermiş. Tekrar giriş yapın.";
  }

  if (status === 403) {
    return "Bu etkinlik için yoklama QR’ı oluşturma yetkiniz bulunmuyor.";
  }

  if (status === 404) {
    return "Etkinlik bulunamadı veya artık kullanılamıyor.";
  }

  if (status === 409) {
    return "Yoklama QR’ı yalnızca yayınlanmış etkinlikler için oluşturulabilir.";
  }

  return "QR oluşturulamadı. Lütfen tekrar deneyin.";
}

export function viewForAttendanceQrState(state: AttendanceQrState): AttendanceQrView {
  switch (state.kind) {
    case "checking-session":
    case "hidden":
      return {
        visible: false,
        message: "",
        showGenerateButton: false,
        buttonLabel: "Yoklama QR’ı Oluştur",
        buttonDisabled: true,
        showQr: false,
        expiryLabel: null,
        remainingLabel: null
      };
    case "idle":
      return {
        visible: true,
        message: "Yoklama QR’ı henüz oluşturulmadı.",
        showGenerateButton: true,
        buttonLabel: "Yoklama QR’ı Oluştur",
        buttonDisabled: false,
        showQr: false,
        expiryLabel: null,
        remainingLabel: null
      };
    case "issuing":
      return {
        visible: true,
        message: "Yoklama QR’ı oluşturuluyor.",
        showGenerateButton: true,
        buttonLabel: "Yoklama QR’ı Oluştur",
        buttonDisabled: true,
        showQr: false,
        expiryLabel: null,
        remainingLabel: null
      };
    case "ready":
      return {
        visible: true,
        message: `Bu QR ${ATTENDANCE_TOKEN_TTL_MINUTES} dakika geçerlidir.`,
        showGenerateButton: true,
        buttonLabel: "QR’ı Yenile",
        buttonDisabled: false,
        showQr: state.remainingSeconds > 0,
        expiryLabel: formatEventDateTime(state.tokenResponse.expiresAt),
        remainingLabel: formatRemainingTime(state.remainingSeconds)
      };
    case "expired":
      return {
        visible: true,
        message: "QR’ın süresi doldu.",
        showGenerateButton: true,
        buttonLabel: "Yoklama QR’ı Oluştur",
        buttonDisabled: false,
        showQr: false,
        expiryLabel: null,
        remainingLabel: null
      };
    case "error":
      return {
        visible: true,
        message: state.message,
        showGenerateButton: true,
        buttonLabel: "Yoklama QR’ı Oluştur",
        buttonDisabled: false,
        showQr: false,
        expiryLabel: null,
        remainingLabel: null
      };
  }
}
