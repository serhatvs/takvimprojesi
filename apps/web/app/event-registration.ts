import type {
  AuthPrincipal,
  EventRegistrationResponse,
  EventRegistrationStatusResponse
} from "@agu/contracts";
import { formatEventDateTime } from "./public-events";

export type EventRegistrationState =
  | { kind: "checking-session" }
  | { kind: "anonymous" }
  | { kind: "forbidden" }
  | { kind: "not-eligible" }
  | { kind: "loading-registration" }
  | { kind: "not-registered" }
  | { kind: "submitting" }
  | { kind: "registered"; registration: EventRegistrationResponse }
  | { kind: "error"; message: string };

export type EventRegistrationView = {
  message: string;
  showJoinButton: boolean;
  showCheckInLink: boolean;
  buttonDisabled: boolean;
  registeredAtLabel: string | null;
  tone: "success" | "warning";
};

export function hasStudentRole(user: AuthPrincipal): boolean {
  return user.globalRoles.includes("STUDENT");
}

export function hasParticipantRole(user: AuthPrincipal): boolean {
  return user.globalRoles.includes("STUDENT") || user.globalRoles.includes("EXTERNAL_PARTICIPANT");
}

export function buildRegistrationStatusPath(eventId: string): string {
  return `/events/${encodeURIComponent(eventId)}/registration`;
}

export function buildRegistrationSubmitPath(eventId: string): string {
  return `/events/${encodeURIComponent(eventId)}/register`;
}

export function stateFromRegistrationStatus(
  status: EventRegistrationStatusResponse
): EventRegistrationState {
  if (status.registered && status.registration) {
    return {
      kind: "registered",
      registration: status.registration
    };
  }

  if (status.eligibilityCode === "not-eligible" || status.eligible === false) {
    return { kind: "not-eligible" };
  }

  return { kind: "not-registered" };
}

export function messageForRegistrationConflict(apiMessage: string): string {
  const normalized = apiMessage.toLowerCase();

  if (normalized.includes("restricted") || normalized.includes("only agu") || normalized.includes("yalnızca agü")) {
    return "Bu etkinlik yalnızca AGÜ öğrencilerine özeldir.";
  }

  if (normalized.includes("already")) {
    return "Bu etkinliğe zaten kayıtlısınız.";
  }

  if (normalized.includes("capacity")) {
    return "Etkinlik kapasitesi dolu.";
  }

  if (normalized.includes("started")) {
    return "Etkinlik başladığı için kayıt yapılamıyor.";
  }

  return "Kayıt işlemi şu anda tamamlanamıyor.";
}

export function viewForRegistrationState(state: EventRegistrationState): EventRegistrationView {
  switch (state.kind) {
    case "checking-session":
      return {
        message: "Oturum durumu kontrol ediliyor.",
        showJoinButton: false,
        showCheckInLink: false,
        buttonDisabled: true,
        registeredAtLabel: null,
        tone: "warning"
      };
    case "anonymous":
      return {
        message: "Katılmak için öğrenci hesabıyla giriş yapmalısınız.",
        showJoinButton: false,
        showCheckInLink: false,
        buttonDisabled: false,
        registeredAtLabel: null,
        tone: "warning"
      };
    case "forbidden":
      return {
        message: "Bu etkinliğe kayıt olmak için öğrenci rolü gerekir.",
        showJoinButton: false,
        showCheckInLink: false,
        buttonDisabled: false,
        registeredAtLabel: null,
        tone: "warning"
      };
    case "not-eligible":
      return {
        message: "Bu etkinlik yalnızca AGÜ öğrencilerine özeldir.",
        showJoinButton: false,
        showCheckInLink: false,
        buttonDisabled: true,
        registeredAtLabel: null,
        tone: "warning"
      };
    case "loading-registration":
      return {
        message: "Kayıt durumunuz kontrol ediliyor.",
        showJoinButton: false,
        showCheckInLink: false,
        buttonDisabled: true,
        registeredAtLabel: null,
        tone: "warning"
      };
    case "not-registered":
      return {
        message: "Bu etkinliğe kayıt olabilirsiniz.",
        showJoinButton: true,
        showCheckInLink: false,
        buttonDisabled: false,
        registeredAtLabel: null,
        tone: "warning"
      };
    case "submitting":
      return {
        message: "Kayıt isteğiniz gönderiliyor.",
        showJoinButton: true,
        showCheckInLink: false,
        buttonDisabled: true,
        registeredAtLabel: null,
        tone: "warning"
      };
    case "registered":
      return {
        message: "Bu etkinliğe kayıtlısınız.",
        showJoinButton: false,
        showCheckInLink: true,
        buttonDisabled: false,
        registeredAtLabel: formatEventDateTime(state.registration.registeredAt),
        tone: "success"
      };
    case "error":
      return {
        message: state.message,
        showJoinButton: false,
        showCheckInLink: false,
        buttonDisabled: false,
        registeredAtLabel: null,
        tone: "warning"
      };
  }
}
