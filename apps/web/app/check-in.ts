import type { AttendanceResponse, AuthPrincipal } from "@agu/contracts";
import { formatEventDateTime } from "./public-events";

export type ParsedCheckInPayload =
  | { ok: true; eventId: string; token: string }
  | { ok: false; message: string };

export type CheckInState =
  | { kind: "checking-session" }
  | { kind: "anonymous" }
  | { kind: "forbidden" }
  | { kind: "ready"; cameraActive: boolean; manualOpen: boolean; message: string | null }
  | { kind: "camera-error"; message: string; manualOpen: boolean }
  | { kind: "submitting" }
  | { kind: "success"; attendance: AttendanceResponse }
  | { kind: "error"; message: string; manualOpen: boolean };

export const INVALID_QR_MESSAGE = "Geçerli bir AGÜ Kampüs Takvimi yoklama QR’ı okunamadı.";

export type CheckInView = {
  message: string;
  canStartCamera: boolean;
  canStopCamera: boolean;
  canSubmitManual: boolean;
  manualOpen: boolean;
  isSubmitting: boolean;
  successCheckedInAtLabel: string | null;
  tone: "success" | "warning";
};

export type StoppableQrScanner = {
  stop: () => Promise<void | null>;
  clear: () => void;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCheckInQrPayload(rawPayload: string): ParsedCheckInPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    return { ok: false, message: INVALID_QR_MESSAGE };
  }

  if (!isObject(parsed)) {
    return { ok: false, message: INVALID_QR_MESSAGE };
  }

  if (parsed.version !== 1) {
    return { ok: false, message: INVALID_QR_MESSAGE };
  }

  if (typeof parsed.eventId !== "string" || parsed.eventId.trim().length === 0) {
    return { ok: false, message: INVALID_QR_MESSAGE };
  }

  if (typeof parsed.token !== "string" || parsed.token.trim().length === 0) {
    return { ok: false, message: INVALID_QR_MESSAGE };
  }

  return {
    ok: true,
    eventId: parsed.eventId,
    token: parsed.token
  };
}

export function hasCheckInAccess(user: AuthPrincipal): boolean {
  return user.globalRoles.includes("STUDENT");
}

export function buildCheckInSubmitPath(_eventId?: string): string {
  return `/attendance/check-in`;
}

export function messageForCheckInResponse(status: number): string {
  if (status === 400) {
    return "QR kod geçersiz veya süresi dolmuş.";
  }

  if (status === 401) {
    return "Oturumunuz sona ermiş. Tekrar giriş yapın.";
  }

  if (status === 403) {
    return "Bu etkinlik için yoklama verme yetkiniz veya kaydınız bulunmuyor.";
  }

  if (status === 404) {
    return "Etkinlik bulunamadı veya artık kullanılamıyor.";
  }

  if (status === 409) {
    return "Yoklama zamanı uygun değil veya yoklamanız daha önce alınmış.";
  }

  return "Yoklama gönderilemedi. Lütfen tekrar deneyin.";
}

export function shouldAcceptScan(state: CheckInState): boolean {
  return state.kind === "ready" || state.kind === "camera-error" || state.kind === "error";
}

export function stateAfterSuccessfulCheckIn(attendance: AttendanceResponse): CheckInState {
  return {
    kind: "success",
    attendance
  };
}

export async function stopQrScannerSafely(scanner: StoppableQrScanner): Promise<void> {
  try {
    await scanner.stop();
  } catch {
    // Some scanner implementations reject when the stream has already ended.
  }

  scanner.clear();
}

export function viewForCheckInState(state: CheckInState): CheckInView {
  switch (state.kind) {
    case "checking-session":
      return {
        message: "Oturum durumu kontrol ediliyor.",
        canStartCamera: false,
        canStopCamera: false,
        canSubmitManual: false,
        manualOpen: false,
        isSubmitting: false,
        successCheckedInAtLabel: null,
        tone: "warning"
      };
    case "anonymous":
      return {
        message: "Yoklama vermek için öğrenci hesabıyla giriş yapmalısınız.",
        canStartCamera: false,
        canStopCamera: false,
        canSubmitManual: false,
        manualOpen: false,
        isSubmitting: false,
        successCheckedInAtLabel: null,
        tone: "warning"
      };
    case "forbidden":
      return {
        message: "Bu ekranı kullanmak için öğrenci rolü gerekir.",
        canStartCamera: false,
        canStopCamera: false,
        canSubmitManual: false,
        manualOpen: false,
        isSubmitting: false,
        successCheckedInAtLabel: null,
        tone: "warning"
      };
    case "ready":
      return {
        message:
          state.message ?? (state.cameraActive ? "Kamera QR kodu bekliyor." : "Kamerayı başlatabilir veya manuel yedek girişi kullanabilirsiniz."),
        canStartCamera: !state.cameraActive,
        canStopCamera: state.cameraActive,
        canSubmitManual: true,
        manualOpen: state.manualOpen,
        isSubmitting: false,
        successCheckedInAtLabel: null,
        tone: "warning"
      };
    case "camera-error":
      return {
        message: state.message,
        canStartCamera: true,
        canStopCamera: false,
        canSubmitManual: true,
        manualOpen: state.manualOpen,
        isSubmitting: false,
        successCheckedInAtLabel: null,
        tone: "warning"
      };
    case "submitting":
      return {
        message: "Yoklama isteğiniz gönderiliyor.",
        canStartCamera: false,
        canStopCamera: false,
        canSubmitManual: false,
        manualOpen: false,
        isSubmitting: true,
        successCheckedInAtLabel: null,
        tone: "warning"
      };
    case "success":
      return {
        message: "Yoklamanız başarıyla alındı.",
        canStartCamera: false,
        canStopCamera: false,
        canSubmitManual: false,
        manualOpen: false,
        isSubmitting: false,
        successCheckedInAtLabel: formatEventDateTime(state.attendance.checkedInAt),
        tone: "success"
      };
    case "error":
      return {
        message: state.message,
        canStartCamera: true,
        canStopCamera: false,
        canSubmitManual: true,
        manualOpen: state.manualOpen,
        isSubmitting: false,
        successCheckedInAtLabel: null,
        tone: "warning"
      };
  }
}
