import { Logger } from "@nestjs/common";

export function validateProductionEnv(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const errors: string[] = [];

  const checkSecret = (name: string, val: string | undefined, minLength = 32) => {
    if (!val) {
      errors.push(`Missing ${name}`);
    } else if (val.length < minLength) {
      errors.push(`${name} must be at least ${minLength} characters long`);
    }
  };

  const databaseUrl = process.env.DATABASE_URL;
  const authSessionSecret = process.env.AUTH_SESSION_SECRET;
  const qrAttendanceSecret = process.env.QR_ATTENDANCE_SECRET;
  const webOrigin = process.env.WEB_ORIGIN;
  const enableDevAuth = process.env.ENABLE_DEV_AUTH;

  if (isProduction) {
    if (!databaseUrl) {
      errors.push("Missing DATABASE_URL");
    }

    checkSecret("AUTH_SESSION_SECRET", authSessionSecret, 32);
    checkSecret("QR_ATTENDANCE_SECRET", qrAttendanceSecret, 32);

    if (authSessionSecret === "replace-with-a-local-development-session-secret") {
      errors.push("AUTH_SESSION_SECRET must be changed in production");
    }

    if (qrAttendanceSecret === "dev-qr-attendance-secret-change-in-production") {
      errors.push("QR_ATTENDANCE_SECRET must be changed in production");
    }

    if (!webOrigin) {
      errors.push("Missing WEB_ORIGIN");
    } else if (webOrigin === "*") {
      errors.push("WEB_ORIGIN must not be '*'");
    }

    if (enableDevAuth === "true") {
      errors.push("ENABLE_DEV_AUTH must not be 'true' in production");
    }

    if (errors.length > 0) {
      throw new Error(`Environment validation failed:\n- ${errors.join("\n- ")}`);
    }
  } else {
    // Non-production
    const warnings: string[] = [];
    if (!databaseUrl) warnings.push("DATABASE_URL");
    if (!authSessionSecret) warnings.push("AUTH_SESSION_SECRET");
    if (!qrAttendanceSecret) warnings.push("QR_ATTENDANCE_SECRET");
    if (!webOrigin) warnings.push("WEB_ORIGIN");

    if (warnings.length > 0) {
      Logger.warn(
        `Missing recommended environment variables: ${warnings.join(", ")}`,
        "EnvValidation"
      );
    }
  }
}
