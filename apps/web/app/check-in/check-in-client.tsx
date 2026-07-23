"use client";

import dynamic from "next/dynamic";

const CheckInPanel = dynamic(
  () => import("./check-in-panel").then((module) => module.CheckInPanel),
  {
    ssr: false,
    loading: () => (
      <div className="notice-panel" role="status">
        Yoklama ekranı hazırlanıyor.
      </div>
    )
  }
);

export function CheckInClient({ apiBaseUrl }: { apiBaseUrl: string }) {
  return <CheckInPanel apiBaseUrl={apiBaseUrl} />;
}
