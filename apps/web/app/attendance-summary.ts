import type { AuthPrincipal, EventAttendanceSummaryResponse } from "@agu/contracts";
import { formatEventDateTime } from "./public-events";

export type AttendanceSummaryState =
  | { kind: "checking-session" }
  | { kind: "hidden" }
  | { kind: "loading" }
  | { kind: "ready"; summary: EventAttendanceSummaryResponse; loadedAt: string }
  | { kind: "refreshing"; summary: EventAttendanceSummaryResponse; loadedAt: string }
  | { kind: "error"; message: string };

export type AttendanceSummaryMetricView = {
  label: string;
  value: string;
};

export type AttendanceSummaryView = {
  visible: boolean;
  message: string | null;
  metrics: AttendanceSummaryMetricView[];
  rateLabel: string | null;
  progressValue: number;
  updatedAtLabel: string | null;
  canRefresh: boolean;
  refreshDisabled: boolean;
};

export function canViewAttendanceSummary(user: AuthPrincipal, clubId: string): boolean {
  if (user.globalRoles.includes("SYSTEM_ADMIN")) {
    return true;
  }

  return user.clubMemberships.some(
    (membership) => membership.clubId === clubId && membership.role === "ADMIN"
  );
}

export function shouldRequestAttendanceSummary(
  user: AuthPrincipal | null | undefined,
  clubId: string
): boolean {
  return user ? canViewAttendanceSummary(user, clubId) : false;
}

export function buildAttendanceSummaryPath(eventId: string): string {
  return `/events/${encodeURIComponent(eventId)}/attendance-summary`;
}

export function attendanceSummaryRequestOptions(): RequestInit {
  return {
    credentials: "include",
    cache: "no-store"
  };
}

export function shouldApplyAttendanceSummaryResponse(isMounted: boolean): boolean {
  return isMounted;
}

function formatMetricNumber(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "-";
  }

  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value);
}

export function formatRemainingCapacity(value: number | null): string {
  if (value === null) {
    return "Sınırsız";
  }

  return formatMetricNumber(value);
}

export function formatAttendanceRate(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "-";
  }

  const formatted = new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 1
  }).format(value);

  return `%${formatted}`;
}

export function messageForAttendanceSummaryError(status: number): string {
  if (status === 401) {
    return "Oturumunuz sona ermiş. Tekrar giriş yapın.";
  }

  if (status === 403) {
    return "Bu etkinliğin katılım özetini görüntüleme yetkiniz yok.";
  }

  if (status === 404) {
    return "Etkinlik bulunamadı veya artık kullanılamıyor.";
  }

  if (status === 409) {
    return "Bu etkinlik için katılım özeti henüz kullanılamıyor.";
  }

  return "Katılım verileri alınamadı. Lütfen tekrar deneyin.";
}

export function viewForAttendanceSummaryState(
  state: AttendanceSummaryState
): AttendanceSummaryView {
  if (state.kind === "checking-session" || state.kind === "hidden") {
    return {
      visible: false,
      message: null,
      metrics: [],
      rateLabel: null,
      progressValue: 0,
      updatedAtLabel: null,
      canRefresh: false,
      refreshDisabled: true
    };
  }

  if (state.kind === "loading") {
    return {
      visible: true,
      message: "Katılım verileri yükleniyor…",
      metrics: [],
      rateLabel: null,
      progressValue: 0,
      updatedAtLabel: null,
      canRefresh: false,
      refreshDisabled: true
    };
  }

  if (state.kind === "error") {
    return {
      visible: true,
      message: state.message,
      metrics: [],
      rateLabel: null,
      progressValue: 0,
      updatedAtLabel: null,
      canRefresh: true,
      refreshDisabled: false
    };
  }

  const { summary, loadedAt } = state;
  const rateLabel = formatAttendanceRate(summary.metrics.attendanceRate);

  return {
    visible: true,
    message: state.kind === "refreshing" ? "Katılım verileri yenileniyor…" : null,
    metrics: [
      {
        label: "Kayıtlı",
        value: formatMetricNumber(summary.metrics.registrationCount)
      },
      {
        label: "Yoklaması Alınan",
        value: formatMetricNumber(summary.metrics.attendanceCount)
      },
      {
        label: "Katılmayan",
        value: formatMetricNumber(summary.metrics.absentCount)
      },
      {
        label: "Kalan Kontenjan",
        value: formatRemainingCapacity(summary.metrics.remainingCapacity)
      },
      {
        label: "Katılım Oranı",
        value: rateLabel
      }
    ],
    rateLabel,
    progressValue:
      Number.isFinite(summary.metrics.attendanceRate) && summary.metrics.attendanceRate > 0
        ? Math.min(summary.metrics.attendanceRate, 100)
        : 0,
    updatedAtLabel: formatEventDateTime(loadedAt),
    canRefresh: true,
    refreshDisabled: state.kind === "refreshing"
  };
}
