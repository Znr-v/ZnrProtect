import { BotContext } from "../index";
import { calculateRiskScore } from "../modules/riskScore";

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

  // Scan all existing members into DB
  for (const [, guild] of ctx.client.guilds.cache) {
    console.log(`[+] Scan des membres de ${guild.name}...`);
    try {
      await guild.members.fetch();
    } catch (e) {
      console.error(`[!] Impossible de fetch les membres de ${guild.name}:`, e);
      continue;
    }

    let synced = 0;
    for (const [, member] of guild.members.cache) {
      if (member.user.bot) continue;
      try {
        const dbMember = await ctx.prisma.member.upsert({
          where: { discordId_guildId: { discordId: member.id, guildId: guild.id } },
          create: {
            discordId: member.id,
            guildId: guild.id,
            username: member.user.username,
            accountAge: member.user.createdAt,
          },
          update: {
            username: member.user.username,
          },
        });

        // Calculate risk score if not already set
        if (dbMember.riskScore === 0) {
          await calculateRiskScore(ctx, member, dbMember);
        }

        synced++;
      } catch (e) {
        console.error(`[!] Erreur sync membre ${member.id}:`, e);
      }
    }
    console.log(`[+] ${synced} membres synchronisés pour ${guild.name}`);
  }

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
