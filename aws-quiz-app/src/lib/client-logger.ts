/**
 * ブラウザ専用の軽量ロガー
 * サーバーサイドの依存関係を持たないクライアント専用のロガー
 */

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
 * ユーザー情報のキャッシュ
 */
let userInfoCache: { userId?: number; role?: string } | null = null;
let userInfoPromise: Promise<{ userId?: number; role?: string }> | null = null;

/**
 * セッション情報を取得してロールを確認（ブラウザ専用）
 */
async function getUserRole(): Promise<{ userId?: number; role?: string }> {
  // キャッシュがある場合は使用
  if (userInfoCache) {
    return userInfoCache;
  }

  // 既にリクエスト中の場合は待機
  if (userInfoPromise) {
    return userInfoPromise;
  }

  // 新しいリクエストを開始
  userInfoPromise = (async () => {
    try {
      const response = await fetch('/api/user/me');
      if (response.ok) {
        const data = await response.json();
        const userInfo = {
          userId: data.user?.id,
          role: data.user?.role
        };
        userInfoCache = userInfo;
        return userInfo;
      }
    } catch {
      // エラーが発生した場合は無視（ESLintルール対応のため変数削除）
    }
    const emptyInfo = {};
    userInfoCache = emptyInfo;
    return emptyInfo;
  })();

  return userInfoPromise;
}

/**
 * ログレベルが出力対象かどうかを判定
 */
function shouldLog(level: LogLevel): boolean {
  const minLevel = (typeof window !== 'undefined' ? 
    window.__LOG_LEVEL__ : 'INFO') as LogLevel || LogLevel.INFO;
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

/**
 * ログを出力する内部関数（ブラウザ専用）
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

  // adminロールのユーザーのみログ出力（厳密チェック）
  if (role && role.toLowerCase() === 'admin') {
    const logMethod = level === LogLevel.ERROR ? console.error : 
                     level === LogLevel.WARN ? console.warn : console.log;
    logMethod(`[${level}] ${message}`, logData);
  }
}

/**
 * ブラウザ専用ロガークラス
 */
export class ClientLogger {
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
}

/**
 * ユーザー情報のキャッシュをクリア（ログアウト時などに使用）
 */
export function clearUserCache(): void {
  userInfoCache = null;
  userInfoPromise = null;
}
