import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { UserService } from "@/lib/database";

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

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  jwt: {
    // ここで署名アルゴリズムやトークン寿命を調整可
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
          console.error("Database error during sign in:", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile?.sub) {
        // Google 初回サインイン時
        token.uid = profile.sub; // Google の一意IDをコピー
        
        try {
          // データベースからユーザー情報を取得
          const dbUser = await UserService.findBySubjectId(profile.sub);
          if (dbUser) {
            token.role = dbUser.role;
            token.dbUserId = dbUser.id;
          }
        } catch (error) {
          console.error("Database error in JWT callback:", error);
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
