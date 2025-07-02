import { NextResponse } from 'next/server';
import { ExtendedApiError, ApiErrorCode } from '@/types/database';

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
 * 内部サーバーエラーレスポンスを作成する
 */
export function createInternalError(error: unknown): NextResponse {
  const details = error instanceof Error ? error.message : '不明なエラー';
  return createErrorResponse(
    'サーバー内部エラーが発生しました',
    500,
    ApiErrorCode.INTERNAL_ERROR,
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
 * 必須フィールドの検証
 */
export function validateRequiredFields(
  obj: Record<string, unknown>,
  requiredFields: string[]
): string[] {
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      missingFields.push(field);
    }
  }
  
  return missingFields;
}

/**
 * APIレスポンスのログ出力
 */
export function logApiRequest(
  method: string,
  path: string,
  userId?: number,
  additionalInfo?: Record<string, unknown>
) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    method,
    path,
    userId,
    ...additionalInfo
  };
  
  console.log('API Request:', JSON.stringify(logData));
}

/**
 * APIエラーのログ出力
 */
export function logApiError(
  method: string,
  path: string,
  error: unknown,
  userId?: number,
  additionalInfo?: Record<string, unknown>
) {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const stack = error instanceof Error ? error.stack : undefined;
  
  const logData = {
    timestamp,
    method,
    path,
    userId,
    error: errorMessage,
    stack,
    ...additionalInfo
  };
  
  console.error('API Error:', JSON.stringify(logData));
}
