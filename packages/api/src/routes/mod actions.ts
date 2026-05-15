import { FastifyInstance, FastifyReply } from "fastify";

const logBotAction = async (prisma: any, guildId: string, action: string, data: any) => {
  try {
    await prisma.botActionLog.create({
      data: {
        guildId,
        action,
        targetId: data.targetId,
        targetName: data.targetName,
        moderatorId: data.moderatorId,
        moderatorName: data.moderatorName,
        reason: data.reason,
        details: data.details,
      },
    });
  } catch (e) {
    console.error("Failed to log bot action:", e);
  }
};

export async function modActionsRoutes(app: FastifyInstance) {
  app.post("/guilds/:guildId/members/:memberId/ban", async (request, reply) => {
    const { guildId, memberId } = request.params as { guildId: string; memberId: string };
    const { reason } = (request.body as any) || {};
    const client = (request as any).client;

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      const member = await guild.members.fetch(memberId).catch(() => null);
      if (!member) return reply.status(404).send({ error: "Membre introuvable" });

      await member.ban({ reason: reason || "Banni depuis le dashboard" });

      const prisma = (request as any).prisma;
      await prisma.member.updateMany({
        where: { discordId: memberId, guildId },
        data: { quarantined: true },
      });

      await logBotAction(prisma, guildId, "BAN", {
        targetId: memberId,
        targetName: member.user.tag,
        reason,
      });

      return reply.send({ success: true, message: `Membre banni: ${member.user.tag}` });
    } catch (e: any) {
      console.error("Ban error:", e);
      return reply.status(500).send({ error: e.message });
    }
  });

  app.post("/guilds/:guildId/members/:memberId/kick", async (request, reply) => {
    const { guildId, memberId } = request.params as { guildId: string; memberId: string };
    const { reason } = (request.body as any) || {};
    const client = (request as any).client;

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      const member = await guild.members.fetch(memberId).catch(() => null);
      if (!member) return reply.status(404).send({ error: "Membre introuvable" });

      await member.kick(reason || "Expulsé depuis le dashboard");

      const prisma = (request as any).prisma;
      await prisma.member.updateMany({
        where: { discordId: memberId, guildId },
        data: { quarantined: true },
      });

      await logBotAction(prisma, guildId, "KICK", {
        targetId: memberId,
        targetName: member.user.tag,
        reason,
      });

      return reply.send({ success: true, message: `Membre expulsé: ${member.user.tag}` });
    } catch (e: any) {
      console.error("Kick error:", e);
      return reply.status(500).send({ error: e.message });
    }
  });

  app.post("/guilds/:guildId/members/:memberId/timeout", async (request, reply) => {
    const { guildId, memberId } = request.params as { guildId: string; memberId: string };
    const { duration, reason, sendDm } = (request.body as any) || { duration: 5, sendDm: true };
    const client = (request as any).client;
    const prisma = (request as any).prisma;

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      const member = await guild.members.fetch(memberId).catch(() => null);
      if (!member) return reply.status(404).send({ error: "Membre introuvable" });

      const durationMs = (duration || 5) * 60 * 1000;
      const timeoutUntil = new Date(Date.now() + durationMs);
      await member.timeout(durationMs, reason || "Mute depuis le dashboard");

      if (sendDm) {
        try {
          const reasonText = reason ? `\n📝 **Raison:** ${reason}` : "";
          const endDate = new Date(Date.now() + durationMs).toLocaleString("fr-FR", { 
            day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" 
          });
          await member.send(`⏰ **Tu as été mute sur ${guild.name}**\n\n🕐 **Durée:** ${duration} minute(s)\n📅 **Fin du mute:** ${endDate}${reasonText}\n\nTu peux @mentionner un modérateur si tu penses que c'est une erreur.`);
        } catch (e) {
          console.log("Impossible d'envoyer le DM");
        }
      }

      await prisma.member.updateMany({
        where: { discordId: memberId, guildId },
        data: { warnCount: { increment: 1 }, timedOutUntil: timeoutUntil },
      });

      await logBotAction(prisma, guildId, "MUTE", {
        targetId: memberId,
        targetName: member.user.tag,
        reason,
        details: { duration, endDate: timeoutUntil.toISOString() },
      });

      return reply.send({ success: true, message: `Membre mute pour ${duration} minute(s)` });
    } catch (e: any) {
      console.error("Timeout error:", e);
      return reply.status(500).send({ error: e.message });
    }
  });

  app.post("/guilds/:guildId/members/:memberId/unmute", async (request, reply) => {
    const { guildId, memberId } = request.params as { guildId: string; memberId: string };
    const { sendDm } = (request.body as any) || { sendDm: true };
    const client = (request as any).client;
    const prisma = (request as any).prisma;

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      const member = await guild.members.fetch(memberId).catch(() => null);
      if (!member) return reply.status(404).send({ error: "Membre introuvable" });

      await member.timeout(null, "Mute retiré depuis le dashboard");

      if (sendDm) {
        try {
          await member.send(`✅ **Mute retiré sur ${guild.name}**\n\nTu peux à nouveau écrire sur le serveur.`);
        } catch (e) {
          console.log("Impossible d'envoyer le DM");
        }
      }

      await prisma.member.updateMany({
        where: { discordId: memberId, guildId },
        data: { timedOutUntil: null },
      });

      await logBotAction(prisma, guildId, "UNMUTE", {
        targetId: memberId,
        targetName: member.user.tag,
      });

      return reply.send({ success: true, message: "Mute retiré" });
    } catch (e: any) {
      console.error("Unmute error:", e);
      return reply.status(500).send({ error: e.message });
    }
  });

  app.post("/guilds/:guildId/members/:memberId/unban", async (request, reply) => {
    const { guildId, memberId } = request.params as { guildId: string; memberId: string };
    const client = (request as any).client;
    const prisma = (request as any).prisma;

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      await guild.bans.remove(memberId).catch(() => null);

      await prisma.member.updateMany({
        where: { discordId: memberId, guildId },
        data: { quarantined: false },
      });

      await logBotAction(prisma, guildId, "UNBAN", {
        targetId: memberId,
      });

      return reply.send({ success: true, message: "Membre débanni" });
    } catch (e: any) {
      console.error("Unban error:", e);
      return reply.status(500).send({ error: e.message });
    }
  });

  app.post("/guilds/:guildId/members/:memberId/trust", async (request, reply) => {
    const { guildId, memberId } = request.params as { guildId: string; memberId: string };
    const { trusted } = (request.body as any) || {};
    const prisma = (request as any).prisma;

    try {
      await prisma.member.updateMany({
        where: { discordId: memberId, guildId },
        data: { trusted },
      });

      await logBotAction(prisma, guildId, trusted ? "TRUST_ADD" : "TRUST_REMOVE", {
        targetId: memberId,
      });

      return reply.send({ success: true, message: trusted ? "Membre marqué comme fiable" : "Marqueur fiable retiré" });
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  app.post("/guilds/:guildId/lockdown", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const { active } = (request.body as any) || {};
    const client = (request as any).client;

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      const prisma = (request as any).prisma;

      if (active) {
        await prisma.guild.update({
          where: { id: guildId },
          data: { lockdownActive: true, lockdownAt: new Date() },
        });

        for (const [, channel] of guild.channels.cache) {
          if (channel.type === 0) {
            try {
              await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
            } catch (e) {
              console.error("Lockdown channel error:", e);
            }
          }
        }
      } else {
        await prisma.guild.update({
          where: { id: guildId },
          data: { lockdownActive: false },
        });

        for (const [, channel] of guild.channels.cache) {
          if (channel.type === 0) {
            try {
              await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
            } catch (e) {
              console.error("Unlock channel error:", e);
            }
          }
        }
      }

      await logBotAction(prisma, guildId, active ? "LOCKDOWN_ON" : "LOCKDOWN_OFF", {
        details: { channelCount: guild.channels.cache.size },
      });

      return reply.send({ success: true, message: active ? "Lockdown activé" : "Lockdown désactivé" });
    } catch (e: any) {
      console.error("Lockdown error:", e);
      return reply.status(500).send({ error: e.message });
    }
  });
}