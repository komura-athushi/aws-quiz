import { NextResponse } from 'next/server';
import { ExtendedApiError, ApiErrorCode } from '@/types/database';
import { Logger } from '@/lib/logger';

/**
 * 標準化されたエラーレスポンスを作成する
 */
export function createErrorResponse(
  message: string,
  status: number,
  code?: ApiErrorCode,
  details?: string
): NextResponse {
  const errorResponse: ExtendedApiError = {
    error: message,
    timestamp: new Date().toISOString(),
    ...(code && { code }),
    ...(details && { details })
  };

  return NextResponse.json(errorResponse, { status });
}

/**
 * バリデーションエラーレスポンスを作成する
 */
export function createValidationError(message: string, details?: string): NextResponse {
  return createErrorResponse(
    message,
    400,
    ApiErrorCode.VALIDATION_ERROR,
    details
  );
}

/**
 * Not Foundエラーレスポンスを作成する
 */
export function createNotFoundError(message: string, details?: string): NextResponse {
  return createErrorResponse(
    message,
    404,
    ApiErrorCode.NOT_FOUND,
    details
  );
}

/**
 * 認証エラーレスポンスを作成する
 */
export function createUnauthorizedError(message: string, details?: string): NextResponse {
  return createErrorResponse(
    message,
    401,
    ApiErrorCode.UNAUTHORIZED,
    details
  );
}

/**
 * データベースエラーレスポンスを作成する
 */
export function createDatabaseError(error: unknown): NextResponse {
  const details = error instanceof Error ? error.message : '不明なエラー';
  return createErrorResponse(
    'データベースエラーが発生しました',
    500,
    ApiErrorCode.DATABASE_ERROR,
    details
  );
}


/**
 * パラメータのバリデーション
 */
export function validatePositiveInteger(value: string): number | null {
  const parsed = parseInt(value);
  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

/**
 * APIレスポンスのログ出力
 */
export async function logApiRequest(
  method: string,
  path: string,
  userId?: number,
  additionalInfo?: Record<string, unknown>
): Promise<void> {
  await Logger.apiRequest(method, path, userId, additionalInfo);
}

/**
 * APIエラーのログ出力
 */
export async function logApiError(
  method: string,
  path: string,
  error: unknown,
  userId?: number,
  additionalInfo?: Record<string, unknown>
): Promise<void> {
  await Logger.apiError(method, path, error, userId, additionalInfo);
}

/**
 * 情報ログを出力
 */
export async function logInfo(
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  await Logger.info(message, data);
}

/**
 * 警告ログを出力
 */
export async function logWarn(
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  await Logger.warn(message, data);
}

/**
 * エラーログを出力
 */
export async function logError(
  message: string,
  error?: Error,
  data?: Record<string, unknown>
): Promise<void> {
  await Logger.error(message, error, data);
}

/**
 * デバッグログを出力
 */
export async function logDebug(
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  await Logger.debug(message, data);
}
