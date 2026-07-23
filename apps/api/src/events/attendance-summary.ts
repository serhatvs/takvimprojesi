import type { EventStatus } from "@prisma/client";

export const ATTENDANCE_SUMMARY_EVENT_STATUSES: EventStatus[] = [
  "PUBLISHED",
  "COMPLETED",
  "CANCELLED"
];

export type AttendanceSummaryMetrics = {
  registrationCount: number;
  attendanceCount: number;
  absentCount: number;
  remainingCapacity: number | null;
  attendanceRate: number;
};

export function calculateAttendanceSummaryMetrics(input: {
  registrationCount: number;
  attendanceCount: number;
  capacity: number | null;
}): AttendanceSummaryMetrics {
  const absentCount = Math.max(input.registrationCount - input.attendanceCount, 0);
  const remainingCapacity =
    input.capacity === null ? null : Math.max(input.capacity - input.registrationCount, 0);
  const attendanceRate =
    input.registrationCount === 0
      ? 0
      : Math.round((input.attendanceCount / input.registrationCount) * 1000) / 10;

  return {
    registrationCount: input.registrationCount,
    attendanceCount: input.attendanceCount,
    absentCount,
    remainingCapacity,
    attendanceRate
  };
}
