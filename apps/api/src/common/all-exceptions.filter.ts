import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import type { Response } from "express";

/**
 * Global exception filter ensuring that unhandled runtime exceptions or database errors
 * NEVER leak stack traces, connection strings, session secrets, or internal tokens to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const body = typeof res === "string" ? { statusCode: status, message: res } : res;
      response.status(status).json(body);
      return;
    }

    // Safe logging without leaking secrets or tokens
    const rawMessage = exception instanceof Error ? exception.message : "Unknown error";
    const sanitizedMessage = this.sanitizeMessage(rawMessage);
    this.logger.error(`Unhandled Exception (500): ${sanitizedMessage}`);

    // In response, return safe generic message and NEVER leak stack trace or internal error details
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error"
    });
  }

  private sanitizeMessage(msg: string): string {
    return msg
      .replace(/postgresql:\/\/[^@]+@/gi, "postgresql://***:***@")
      .replace(/secret=[^&\s]+/gi, "secret=***")
      .replace(/token=[^&\s]+/gi, "token=***");
  }
}
