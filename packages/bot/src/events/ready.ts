import { BotContext } from "../index";

export async function onReady(ctx: BotContext) {
  // Sync guilds to database
  for (const [, guild] of ctx.client.guilds.cache) {
    await ctx.prisma.guild.upsert({
      where: { id: guild.id },
      create: {
        id: guild.id,
        name: guild.name,
        ownerId: guild.ownerId,
        config: { create: {} },
      },
      update: {
        name: guild.name,
        ownerId: guild.ownerId,
      },
    });
  }
  console.log("[+] Guilds synchronisées avec la DB");

  // Take initial audit snapshot for each guild
  for (const [, guild] of ctx.client.guilds.cache) {
    const roles = guild.roles.cache.map((r) => ({
      id: r.id,
      name: r.name,
      permissions: r.permissions.bitfield.toString(),
      position: r.position,
    }));
    const channels = guild.channels.cache.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    }));

    await ctx.prisma.auditSnapshot.create({
      data: {
        guildId: guild.id,
        snapshot: { roles, channels, takenAt: new Date().toISOString() },
      },
    });
  }
  console.log("[+] Snapshots d'audit initiaux créés");
}
