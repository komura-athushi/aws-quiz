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
 * ログ出力の設定
 */
interface LoggerConfig {
  enableConsoleLog: boolean;
  enableBrowserLog: boolean;
  minLevel: LogLevel;
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
 * 現在の環境がブラウザかどうかを判定
 */
const isBrowser = typeof window !== 'undefined';

/**
 * セッション情報を取得してロールを確認
 */
async function getUserRole(): Promise<{ userId?: number; role?: string }> {
  if (isBrowser) {
    // ブラウザ環境では直接セッションにアクセスできないので、APIを通じて取得
    try {
      const response = await fetch('/api/user/me');
      if (response.ok) {
        const data = await response.json();
        return {
          userId: data.user?.id,
          role: data.user?.role
        };
      }
    } catch {
      // エラーが発生した場合は無視（ESLintルール対応のため変数削除）
    }
    return {};
  } else {
    // サーバーサイドではセッションを直接取得
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
}

/**
 * ログ設定を取得
 */
function getLoggerConfig(): LoggerConfig {
  const minLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
  
  return {
    enableConsoleLog: true, // サーバーサイドでは常に有効
    enableBrowserLog: !isBrowser, // ブラウザでは無効（adminのみ有効にする）
    minLevel
  };
}

/**
 * ログレベルが出力対象かどうかを判定
 */
function shouldLog(level: LogLevel, config: LoggerConfig): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[config.minLevel];
}

/**
 * ログを出力する内部関数
 */
async function logInternal(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
  error?: Error
): Promise<void> {
  const config = getLoggerConfig();
  
  if (!shouldLog(level, config)) {
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

  // サーバーサイドでは常にコンソールに出力
  if (!isBrowser && config.enableConsoleLog) {
    const logMethod = level === LogLevel.ERROR ? console.error : 
                     level === LogLevel.WARN ? console.warn : console.log;
    logMethod(`[${level}] ${message}`, logData);
  }

  // ブラウザではadminロールのみログ出力
  if (isBrowser && role === 'admin') {
    const logMethod = level === LogLevel.ERROR ? console.error : 
                     level === LogLevel.WARN ? console.warn : console.log;
    logMethod(`[${level}] ${message}`, logData);
  }
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

/**
 * 従来のログ関数との互換性を保つためのヘルパー関数
 */
export async function logApiRequest(
  method: string,
  path: string,
  userId?: number,
  additionalInfo?: Record<string, unknown>
): Promise<void> {
  await Logger.apiRequest(method, path, userId, additionalInfo);
}

export async function logApiError(
  method: string,
  path: string,
  error: unknown,
  userId?: number,
  additionalInfo?: Record<string, unknown>
): Promise<void> {
  await Logger.apiError(method, path, error, userId, additionalInfo);
}
