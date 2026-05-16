import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { SignJWT } from "jose";

const handler = NextAuth({
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: "identify guilds" } },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
    },
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        const discordId = (profile as any)?.id || account.providerAccountId;
        if (discordId) {
          token.discordId = discordId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken || "";
      (session as any).discordId = token.discordId || "";

      const discordId = token.discordId || "";
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
      const apiToken = await new SignJWT({ discordId })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(secret);
      (session as any).apiToken = apiToken;

      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});

export { handler as GET, handler as POST };
