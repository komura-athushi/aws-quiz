import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
        token.uid = profile?.sub;   // Google の一意IDをコピー
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid as string; // ← フロントで使える
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
