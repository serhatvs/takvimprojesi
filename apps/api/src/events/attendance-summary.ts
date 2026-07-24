import type { EventStatus } from "@prisma/client";

export const ATTENDANCE_SUMMARY_EVENT_STATUSES: EventStatus[] = [
  "PUBLISHED",
  "COMPLETED",
  "CANCELLED"
];

export type AttendanceSummaryMetrics = {
  registeredCount: number;
  attendanceCount: number;
  absentCount: number;
  capacityRemaining: number | null;
  registrationRate: number | null;
  attendanceRate: number;
  registrationCount: number;
  remainingCapacity: number | null;
};

export function calculateAttendanceSummaryMetrics(input: {
  registrationCount: number;
  attendanceCount: number;
  capacity: number | null;
}): AttendanceSummaryMetrics {
  const absentCount = Math.max(input.registrationCount - input.attendanceCount, 0);
  const remainingCapacity =
    input.capacity === null ? null : Math.max(input.capacity - input.registrationCount, 0);
  const registrationRate =
    input.capacity && input.capacity > 0
      ? Math.round((input.registrationCount / input.capacity) * 10000) / 100
      : null;
  const attendanceRate =
    input.registrationCount === 0
      ? 0
      : Math.round((input.attendanceCount / input.registrationCount) * 10000) / 100;

  return {
    registeredCount: input.registrationCount,
    attendanceCount: input.attendanceCount,
    absentCount,
    capacityRemaining: remainingCapacity,
    registrationRate,
    attendanceRate,
    registrationCount: input.registrationCount,
    remainingCapacity
  };
}
