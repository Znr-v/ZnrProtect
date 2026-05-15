import { FastifyInstance } from "fastify";

const DISCORD_API = "https://discord.com/api/v10";

export async function authRoutes(app: FastifyInstance) {
  // Exchange Discord OAuth code for user data
  app.post("/discord", async (request, reply) => {
    const { code } = request.body as { code: string };
    if (!code) return reply.status(400).send({ error: "Code requis" });

    // Exchange code for token
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/discord`,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return reply.status(401).send({ error: "Token invalide" });
    }

    // Get user
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    // Get guilds
    const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const guilds = await guildsRes.json();

    // Save/update dashboard user
    const prisma = (request as any).prisma;
    await prisma.dashboardUser.upsert({
      where: { discordId: user.id },
      create: { discordId: user.id, username: user.username, avatar: user.avatar },
      update: { username: user.username, avatar: user.avatar, lastLoginAt: new Date() },
    });

    return {
      user: { id: user.id, username: user.username, avatar: user.avatar },
      guilds: guilds.filter((g: any) => (parseInt(g.permissions) & 0x8) === 0x8),
      accessToken: tokenData.access_token,
    };
  });
}
