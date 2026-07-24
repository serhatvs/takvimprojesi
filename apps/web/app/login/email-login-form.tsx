"use client";

import { EMAIL_OTP_RESEND_COOLDOWN_SECONDS } from "@agu/config";
import { StatusBadge } from "@agu/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  cleanOtpCode,
  isValidEmailFormat,
  mapAuthApiError,
  validateReturnTo
} from "./auth-utils";

type Step = "email" | "code" | "display-name";

type EmailLoginFormProps = {
  apiBaseUrl: string;
  returnTo?: string | undefined;
};

export function EmailLoginForm({ apiBaseUrl, returnTo }: EmailLoginFormProps) {
  const router = useRouter();
  const safeReturnTo = validateReturnTo(returnTo);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [resendCooldown, setResendCooldown] = useState(0);
  const submittingRef = useRef(false);

  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const displayNameInputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up resend timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Auto-focus logic when step changes
  useEffect(() => {
    if (step === "code") {
      setTimeout(() => codeInputRef.current?.focus(), 50);
    } else if (step === "display-name") {
      setTimeout(() => displayNameInputRef.current?.focus(), 50);
    }
  }, [step]);

  function startResendTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setResendCooldown(EMAIL_OTP_RESEND_COOLDOWN_SECONDS);

    timerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleRequestCode(e?: React.FormEvent) {
    if (e) {
      e.preventDefault();
    }

    if (submittingRef.current) {
      return;
    }

    const trimmedEmail = email.trim();
    if (!isValidEmailFormat(trimmedEmail)) {
      setErrorMessage("Lütfen geçerli bir e-posta adresi girin.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/email/request-code`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: trimmedEmail })
      });

      if (response.status === 202) {
        const body = await response.json().catch(() => null);
        setEmail(trimmedEmail);
        setStep("code");
        setCode("");
        setInfoMessage(
          body?.message || "Kod gönderilebildiyse e-posta adresinize ulaştırıldı."
        );
        startResendTimer();
      } else {
        const errorBody = await response.json().catch(() => null);
        setErrorMessage(mapAuthApiError(response.status, errorBody));
      }
    } catch {
      setErrorMessage(mapAuthApiError(0));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(e?: React.FormEvent) {
    if (e) {
      e.preventDefault();
    }

    if (submittingRef.current) {
      return;
    }

    const cleanedCode = cleanOtpCode(code);
    if (cleanedCode.length !== 6) {
      setErrorMessage("Lütfen 6 haneli doğrulama kodunu eksiksiz girin.");
      return;
    }

    const payload: { email: string; code: string; displayName?: string } = {
      email,
      code: cleanedCode
    };

    if (step === "display-name") {
      const trimmedName = displayName.trim();
      if (!trimmedName || trimmedName.length < 2) {
        setErrorMessage("Lütfen en az 2 karakterden oluşan geçerli bir ad soyad girin.");
        return;
      }
      payload.displayName = trimmedName;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/email/verify-code`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setInfoMessage("Giriş başarılı! Yönlendiriliyorsunuz...");
        router.refresh();
        router.push(safeReturnTo);
        return;
      }

      const errorBody = await response.json().catch(() => null);

      if (
        response.status === 400 &&
        errorBody?.code === "DISPLAY_NAME_REQUIRED"
      ) {
        setStep("display-name");
        setInfoMessage(
          "İlk defa giriş yaptığınız için lütfen ad ve soyadınızı belirtin."
        );
        return;
      }

      setErrorMessage(mapAuthApiError(response.status, errorBody));
    } catch {
      setErrorMessage(mapAuthApiError(0));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0 || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/email/request-code`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      if (response.status === 202) {
        setCode("");
        setInfoMessage("Yeni doğrulama kodu gönderildi. Eski kodunuz geçersiz olmuş olabilir.");
        startResendTimer();
      } else {
        const errorBody = await response.json().catch(() => null);
        setErrorMessage(mapAuthApiError(response.status, errorBody));
      }
    } catch {
      setErrorMessage(mapAuthApiError(0));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="login-card" aria-label="E-posta ile Giriş Formu">
      {errorMessage ? (
        <div style={{ marginBottom: "1rem" }}>
          <StatusBadge tone="warning">{errorMessage}</StatusBadge>
        </div>
      ) : null}

      {infoMessage ? (
        <div style={{ marginBottom: "1rem" }}>
          <StatusBadge tone="success">{infoMessage}</StatusBadge>
        </div>
      ) : null}

      {step === "email" ? (
        <form onSubmit={handleRequestCode} noValidate>
          <div className="form-group">
            <label htmlFor="email-input">
              <span>E-posta Adresi</span>
            </label>
            <input
              id="email-input"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@agu.edu.tr veya kisi@gmail.com"
              disabled={submitting}
              required
            />
            <p className="field-help">
              AGÜ kullanıcıları @agu.edu.tr adresleriyle, dış katılımcılar ise kendi e-posta adresleriyle giriş yapabilir.
            </p>
          </div>

          <div className="form-actions" style={{ marginTop: "1.5rem" }}>
            <button
              type="submit"
              className="primary-action"
              disabled={submitting || !email.trim()}
              style={{ width: "100%" }}
            >
              {submitting ? "Gönderiliyor..." : "Kod Gönder"}
            </button>
          </div>
        </form>
      ) : null}

      {step === "code" ? (
        <form onSubmit={handleVerifyCode} noValidate>
          <div className="form-group">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.5rem"
              }}
            >
              <span style={{ fontSize: "0.9rem", color: "#52616b" }}>
                Kod Gönderilen Adres: <strong>{email}</strong>
              </span>
              <button
                type="button"
                className="secondary-action"
                style={{ padding: "2px 8px", fontSize: "0.8rem" }}
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                disabled={submitting}
              >
                E-posta Değiştir
              </button>
            </div>

            <label htmlFor="code-input">
              <span>Doğrulama Kodu (6 Hane)</span>
            </label>
            <input
              ref={codeInputRef}
              id="code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(cleanOtpCode(e.target.value))}
              onPaste={(e) => {
                const paste = e.clipboardData.getData("text");
                setCode(cleanOtpCode(paste));
              }}
              placeholder="123456"
              disabled={submitting}
              style={{
                letterSpacing: "0.25em",
                fontSize: "1.25rem",
                textAlign: "center"
              }}
              required
            />
          </div>

          <div
            className="form-actions"
            style={{
              marginTop: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem"
            }}
          >
            <button
              type="submit"
              className="primary-action"
              disabled={submitting || code.length !== 6}
              style={{ width: "100%" }}
            >
              {submitting ? "Doğrulanıyor..." : "Giriş Yap"}
            </button>

            <button
              type="button"
              className="secondary-action"
              onClick={handleResendCode}
              disabled={submitting || resendCooldown > 0}
              style={{ width: "100%" }}
            >
              {resendCooldown > 0
                ? `Kodu Yeniden Gönder (${resendCooldown}s)`
                : "Kodu Yeniden Gönder"}
            </button>
          </div>
        </form>
      ) : null}

      {step === "display-name" ? (
        <form onSubmit={handleVerifyCode} noValidate>
          <div className="form-group">
            <p style={{ fontSize: "0.9rem", color: "#52616b", marginBottom: "1rem" }}>
              AGÜ Kampüs Takvimi&apos;ne ilk defa giriş yaptığınız için lütfen ad ve soyadınızı belirtin.
            </p>

            <label htmlFor="display-name-input">
              <span>Ad Soyad</span>
            </label>
            <input
              ref={displayNameInputRef}
              id="display-name-input"
              type="text"
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ad Soyad"
              maxLength={100}
              minLength={2}
              disabled={submitting}
              required
            />
          </div>

          <div className="form-actions" style={{ marginTop: "1.5rem" }}>
            <button
              type="submit"
              className="primary-action"
              disabled={submitting || displayName.trim().length < 2}
              style={{ width: "100%" }}
            >
              {submitting ? "Kaydediliyor..." : "Tamamla ve Giriş Yap"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
