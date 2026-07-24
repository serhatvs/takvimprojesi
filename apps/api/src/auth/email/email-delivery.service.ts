import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

export interface SendOtpOptions {
  to: string;
  code: string;
  expiresInMinutes: number;
}

export abstract class EmailDeliveryService {
  abstract sendOtp(options: SendOtpOptions): Promise<void>;
}

@Injectable()
export class ConsoleEmailDeliveryService implements EmailDeliveryService {
  private readonly logger = new Logger(ConsoleEmailDeliveryService.name);

  async sendOtp(options: SendOtpOptions): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ConsoleEmailDeliveryService cannot be used in production.");
    }

    this.logger.log(
      `[DEV EMAIL OTP] To: ${options.to} | Code: ${options.code} | Expires in: ${options.expiresInMinutes} min`
    );
  }
}

@Injectable()
export class SmtpEmailDeliveryService implements EmailDeliveryService {
  private readonly logger = new Logger(SmtpEmailDeliveryService.name);

  async sendOtp(options: SendOtpOptions): Promise<void> {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === "true";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const from = process.env.EMAIL_FROM || "no-reply@agu.edu.tr";

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined
    });

    try {
      await transporter.sendMail({
        from,
        to: options.to,
        subject: "AGÜ Kampüs Takvimi - Giriş Kodu",
        text: `AGÜ Kampüs Takvimi giriş kodunuz: ${options.code}\n\nBu kod ${options.expiresInMinutes} dakika süreyle geçerlidir.`
      });
    } catch (err) {
      this.logger.error(`Failed to send email via SMTP: ${(err as Error)?.message}`);
      throw new Error("Email sending failed", { cause: err });
    }
  }
}
