export const DEFAULT_TIME_ZONE = "Europe/Istanbul" as const;
export const DEFAULT_API_PORT = 3001;

export function getApiBaseUrl(): string {
  const runtime = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtime.process?.env?.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}
