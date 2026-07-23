export const USER_ROLES = [
  "STUDENT",
  "CLUB_MEMBER",
  "CLUB_ADMIN",
  "PRESS_EDITOR",
  "SYSTEM_ADMIN"
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const EVENT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "CHANGES_REQUESTED",
  "REJECTED",
  "APPROVED",
  "PUBLISHED",
  "CANCELLED",
  "COMPLETED"
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_REVIEW_DECISIONS = [
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED"
] as const;

export type EventReviewDecision = (typeof EVENT_REVIEW_DECISIONS)[number];

export interface HealthResponse {
  status: "ok";
  service: "agu-api";
  timeZone: "Europe/Istanbul";
  checkedAt: string;
}

export interface AuthClubMembership {
  clubId: string;
  clubSlug: string;
  clubName: string;
  role: "MEMBER" | "ADMIN";
}

export interface AuthPrincipal {
  userId: string;
  email: string;
  displayName: string;
  globalRoles: UserRole[];
  clubMemberships: AuthClubMembership[];
}

export interface AuthMeResponse {
  user: AuthPrincipal;
}

export interface EventSummary {
  id: string;
  title: string;
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  clubName: string;
}

export interface CreateDraftEventRequest {
  clubId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  capacity?: number;
}

export interface DraftEventResponse {
  id: string;
  clubId: string;
  createdById: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  capacity: number | null;
  status: "DRAFT";
  createdAt: string;
  updatedAt: string;
}

export interface EventResponse {
  id: string;
  clubId: string;
  createdById: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  capacity: number | null;
  status: EventStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewEventRequest {
  comment?: string;
}

export interface PublicEventClub {
  id: string;
  name: string;
  slug: string;
}

export interface PublicEventListItem {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  capacity: number | null;
  status: "PUBLISHED";
  publishedAt: string | null;
  club: PublicEventClub;
}

export interface PublicEventDetailResponse {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  capacity: number | null;
  status: "PUBLISHED";
  publishedAt: string | null;
  club: PublicEventClub;
}

export interface PaginationResponse {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PublicEventListResponse {
  items: PublicEventListItem[];
  pagination: PaginationResponse;
}

export interface EventRegistrationResponse {
  id: string;
  eventId: string;
  userId: string;
  registeredAt: string;
}

export interface EventRegistrationStatusResponse {
  registered: boolean;
  registration: EventRegistrationResponse | null;
}

export interface AttendanceTokenResponse {
  eventId: string;
  token: string;
  expiresAt: string;
}

export interface AttendanceResponse {
  id: string;
  eventId: string;
  userId: string;
  checkedInAt: string;
}

export interface EventAttendanceSummaryResponse {
  event: {
    id: string;
    title: string;
    status: EventStatus;
    startsAt: string;
    endsAt: string;
    capacity: number | null;
  };
  metrics: {
    registrationCount: number;
    attendanceCount: number;
    absentCount: number;
    remainingCapacity: number | null;
    attendanceRate: number;
  };
  generatedAt: string;
}

export { EVENT_TRANSITIONS, canTransitionEvent } from "./event-lifecycle";
export type { EventTransition } from "./event-lifecycle";
