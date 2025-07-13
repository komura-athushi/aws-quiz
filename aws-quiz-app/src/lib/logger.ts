/**
 * ログレベルの定義
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * ログデータの型定義
 */
interface LogData {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  userId?: number;
  userRole?: string;
  stack?: string;
}

/**
 * ログレベルの優先順位
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3
};

/**
 * サーバーサイドでセッション情報を取得してロールを確認
 */
async function getUserRole(): Promise<{ userId?: number; role?: string }> {
  try {
    // 動的インポートを使用してサーバーサイドでのみ認証モジュールを読み込み
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/lib/auth');
    
    const session = await getServerSession(authOptions);
    return {
      ...(session?.user?.dbUserId && { userId: session.user.dbUserId }),
      ...(session?.user?.role && { role: session.user.role })
    };
  } catch {
    // エラーが発生した場合は無視（ESLintルール対応のため変数削除）
    return {};
  }
}

/**
 * ログレベルが出力対象かどうかを判定
 */
const MIN_LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LOG_LEVEL];
}

/**
 * サーバーサイド専用ログ出力関数
 */
async function logInternal(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
  error?: Error
): Promise<void> {
  if (!shouldLog(level)) {
    return;
  }

  const { userId, role } = await getUserRole();
  const timestamp = new Date().toISOString();
  
  const logData: LogData = {
    timestamp,
    level,
    message,
    ...(data && { data }),
    ...(userId && { userId }),
    ...(role && { userRole: role }),
    ...(error?.stack && { stack: error.stack })
  };

  // CloudWatch対応：JSON形式で単一ログエントリとして出力
  const logMethod = level === LogLevel.ERROR ? console.error : 
                   level === LogLevel.WARN ? console.warn : console.log;
  logMethod(JSON.stringify(logData));
}

/**
 * ロガークラス
 */
export class Logger {
  /**
   * デバッグログを出力
   */
  static async debug(message: string, data?: Record<string, unknown>): Promise<void> {
    await logInternal(LogLevel.DEBUG, message, data);
  }

  /**
   * 情報ログを出力
   */
  static async info(message: string, data?: Record<string, unknown>): Promise<void> {
    await logInternal(LogLevel.INFO, message, data);
  }

  /**
   * 警告ログを出力
   */
  static async warn(message: string, data?: Record<string, unknown>): Promise<void> {
    await logInternal(LogLevel.WARN, message, data);
  }

  /**
   * エラーログを出力
   */
  static async error(message: string, error?: Error, data?: Record<string, unknown>): Promise<void> {
    await logInternal(LogLevel.ERROR, message, data, error);
  }

  /**
   * APIリクエストログを出力
   */
  static async apiRequest(
    method: string,
    path: string,
    userId?: number,
    additionalInfo?: Record<string, unknown>
  ): Promise<void> {
    await logInternal(LogLevel.INFO, `API Request: ${method} ${path}`, {
      method,
      path,
      userId,
      ...additionalInfo
    });
  }

  /**
   * APIエラーログを出力
   */
  static async apiError(
    method: string,
    path: string,
    error: unknown,
    userId?: number,
    additionalInfo?: Record<string, unknown>
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    await logInternal(LogLevel.ERROR, `API Error: ${method} ${path} - ${errorMessage}`, {
      method,
      path,
      userId,
      error: errorMessage,
      ...additionalInfo
    }, errorObj);
  }
}
