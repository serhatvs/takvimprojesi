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
  const enableEmailAuth = process.env.ENABLE_EMAIL_AUTH;
  const emailDeliveryMode = process.env.EMAIL_DELIVERY_MODE ?? "console";
  const emailOtpSecret = process.env.EMAIL_OTP_SECRET;
  const emailFrom = process.env.EMAIL_FROM;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;

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

    if (emailDeliveryMode === "console") {
      errors.push("EMAIL_DELIVERY_MODE=console is not allowed in production");
    }

    if (enableEmailAuth === "true") {
      checkSecret("EMAIL_OTP_SECRET", emailOtpSecret, 32);

      if (emailOtpSecret === "dev-email-otp-secret-change-in-production") {
        errors.push("EMAIL_OTP_SECRET must be changed in production");
      }

      if (
        emailOtpSecret &&
        (emailOtpSecret === authSessionSecret || emailOtpSecret === qrAttendanceSecret)
      ) {
        errors.push("EMAIL_OTP_SECRET must be separate from session and QR secrets");
      }

      if (!emailFrom) {
        errors.push("Missing EMAIL_FROM");
      }

      if (!smtpHost) {
        errors.push("Missing SMTP_HOST");
      }

      if (!smtpPort) {
        errors.push("Missing SMTP_PORT");
      }
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
