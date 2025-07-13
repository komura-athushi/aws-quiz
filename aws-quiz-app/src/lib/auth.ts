import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { UserService } from "@/lib/database";
import { logError } from "@/lib/api-utils";

/*
 * Aurora Serverless v2対応認証設定
 * 
 * 主な特徴:
 * - Aurora Serverless v2の最小キャパシティ0時の起動遅延に対応
 * - 接続タイムアウトを90秒に設定（環境変数で調整可能）
 * 
 * 環境変数:
 * - AURORA_CONNECTION_TIMEOUT: 接続タイムアウト（秒）
 */

// 環境変数が設定されていない場合のエラーチェック
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("Missing NEXTAUTH_SECRET environment variable");
}

if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error("Missing GOOGLE_CLIENT_ID environment variable");
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Missing GOOGLE_CLIENT_SECRET environment variable");
}

// セッション設定のデフォルト値
const SESSION_MAX_AGE_DAYS = parseInt(process.env.SESSION_MAX_AGE_DAYS || "7"); // 日数
const JWT_MAX_AGE_HOURS = parseFloat(process.env.JWT_MAX_AGE_HOURS || "1"); // 時間（小数点可）

// 秒単位に変換
const SESSION_MAX_AGE = SESSION_MAX_AGE_DAYS * 24 * 60 * 60; // 日数 → 秒
const JWT_MAX_AGE = Math.floor(JWT_MAX_AGE_HOURS * 60 * 60); // 時間 → 秒

// Google Providerを使用
// https://next-auth.js.org/providers/google
export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { 
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE, // 環境変数から取得
  },
  jwt: {
    maxAge: JWT_MAX_AGE, // 環境変数から取得
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && profile?.sub) {
        try {
          // ユーザーをデータベースに登録または更新
          await UserService.upsertUser({
            provider: "google",
            subject_id: profile.sub,
            name: user.name || profile.name || "Unknown User",
            role: "user",
          });
          return true;
        } catch (error) {
          await logError("Database error during sign in", error as Error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile?.sub) {
        // Googleアカウント 初回サインイン時
        token.uid = profile.sub; // Google の一意IDをコピー
        
        try {
          // データベースからユーザー情報を取得
          const dbUser = await UserService.findBySubjectId(profile.sub);
          if (dbUser) {
            token.role = dbUser.role;
            token.dbUserId = dbUser.id;
          }
        } catch (error) {
          await logError("Database error in JWT callback", error as Error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string; // ← フロントで使える
        session.user.role = token.role as "user" | "admin";
        session.user.dbUserId = token.dbUserId as number;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET, // 事前にチェックしているのでアサーション不要
};
