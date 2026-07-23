import type { ReactNode } from "react";

export function StatusBadge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  return <span data-tone={tone}>{children}</span>;
}
