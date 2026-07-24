import { DEFAULT_API_PORT } from "@agu/config";

export function resolveApiPort(
  env: Record<string, string | undefined> = process.env
): number {
  const rawPort = env.PORT ?? env.API_PORT ?? DEFAULT_API_PORT;
  const parsed = Number(rawPort);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }
  return Number(DEFAULT_API_PORT);
}
