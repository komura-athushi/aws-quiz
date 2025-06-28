import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

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
    async jwt({ token, account, profile }) {
      if (account) {
        // Google 初回サインイン時
        token.uid = profile?.sub; // Google の一意IDをコピー
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid as string; // ← フロントで使える
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET, // 事前にチェックしているのでアサーション不要
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
