import { FastifyInstance, FastifyReply } from "fastify";
import { getDiscordIdFromRequest, requirePermission, DASHBOARD_PERMISSIONS, logAudit } from "../lib/permissions";

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
    const { reason, sendDm } = (request.body as any) || {};
    const client = (request as any).client;
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.MANAGE_MEMBERS);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      const member = await guild.members.fetch(memberId).catch(() => null);
      if (!member) return reply.status(404).send({ error: "Membre introuvable" });

      if (sendDm !== false) {
        try {
          await member.send({
            embeds: [{
              color: 0xEF4444,
              title: "🚫 Tu as été banni",
              description: `**Serveur:** ${guild.name}`,
              fields: reason ? [{ name: "📝 Raison", value: reason, inline: false }] : [],
              timestamp: new Date().toISOString(),
            }]
          });
        } catch (e) {
          console.log("Impossible d'envoyer le DM de ban");
        }
      }

      const banReason = reason || "Banni depuis le dashboard";
      await member.ban({ reason: banReason });

      await prisma.member.updateMany({
        where: { discordId: memberId, guildId },
        data: { quarantined: true },
      });

      await logBotAction(prisma, guildId, "BAN", {
        targetId: memberId,
        targetName: member.user.tag,
        reason,
      });

      await logAudit(prisma, discordId!, "BAN_MEMBER", {
        guildId,
        targetId: memberId,
        metadata: { reason },
      });

      return reply.send({ success: true, message: `Membre banni: ${member.user.tag}` });
    } catch (e: any) {
      console.error("Ban error:", e);
      return reply.status(500).send({ error: e.message });
    }
  });

  app.post("/guilds/:guildId/members/:memberId/kick", async (request, reply) => {
    const { guildId, memberId } = request.params as { guildId: string; memberId: string };
    const { reason, sendDm } = (request.body as any) || {};
    const client = (request as any).client;
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.MANAGE_MEMBERS);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      const member = await guild.members.fetch(memberId).catch(() => null);
      if (!member) return reply.status(404).send({ error: "Membre introuvable" });

      if (sendDm !== false) {
        try {
          await member.send({
            embeds: [{
              color: 0xF97316,
              title: "👢 Tu as été exclu",
              description: `**Serveur:** ${guild.name}`,
              fields: reason ? [{ name: "📝 Raison", value: reason, inline: false }] : [],
              timestamp: new Date().toISOString(),
            }]
          });
        } catch (e) {
          console.log("Impossible d'envoyer le DM d'exclusion");
        }
      }

      const kickReason = reason || "Expulsé depuis le dashboard";
      await member.kick(kickReason);

      await prisma.member.deleteMany({
        where: { discordId: memberId, guildId },
      });

      await logBotAction(prisma, guildId, "KICK", {
        targetId: memberId,
        targetName: member.user.tag,
        reason,
      });

      await logAudit(prisma, discordId!, "KICK_MEMBER", {
        guildId,
        targetId: memberId,
        metadata: { reason },
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
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.MANAGE_MEMBERS);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

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
          const endTimestamp = Math.floor((Date.now() + durationMs) / 1000);
          await member.send({
            embeds: [{
              color: 0xFBBF24,
              title: "⏱️ Tu as été mute",
              description: `**Serveur:** ${guild.name}`,
              fields: [
                { name: "🕐 Durée", value: `${duration} minute(s)`, inline: true },
                { name: "⏰ Fin du mute", value: `<t:${endTimestamp}:F>\n(<t:${endTimestamp}:R>)`, inline: true },
              ],
              footer: { text: reason ? `Raison: ${reason}` : "Merci de respecter les règles du serveur" },
              timestamp: new Date().toISOString(),
            }]
          });
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

      await logAudit(prisma, discordId!, "TIMEOUT_MEMBER", {
        guildId,
        targetId: memberId,
        metadata: { duration, reason },
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
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.MANAGE_MEMBERS);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

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

      await logAudit(prisma, discordId!, "UNMUTE_MEMBER", {
        guildId,
        targetId: memberId,
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
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.MANAGE_MEMBERS);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      const banEntry = await guild.bans.fetch(memberId).catch(() => null);
      const banReason = banEntry?.reason || null;

      await guild.bans.remove(memberId).catch(() => null);

      const memberData = await prisma.member.findFirst({
        where: { discordId: memberId, guildId },
      });

      await prisma.member.updateMany({
        where: { discordId: memberId, guildId },
        data: { quarantined: false },
      });

      await logBotAction(prisma, guildId, "UNBAN", {
        targetId: memberId,
        targetName: memberData?.username || memberId,
        details: banReason ? { previousBanReason: banReason } : undefined,
      });

      await logAudit(prisma, discordId!, "UNBAN_MEMBER", {
        guildId,
        targetId: memberId,
        metadata: { previousBanReason: banReason },
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
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.MANAGE_MEMBERS);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    try {
      await prisma.member.updateMany({
        where: { discordId: memberId, guildId },
        data: { trusted },
      });

      const memberData = await prisma.member.findFirst({
        where: { discordId: memberId, guildId },
      });

      await logBotAction(prisma, guildId, trusted ? "TRUST_ADD" : "TRUST_REMOVE", {
        targetId: memberId,
        targetName: memberData?.username || memberId,
      });

      await logAudit(prisma, discordId!, trusted ? "ADD_TRUST" : "REMOVE_TRUST", {
        guildId,
        targetId: memberId,
      });

      return reply.send({ success: true, message: trusted ? "Membre marqué comme fiable" : "Marqueur fiable retiré" });
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  app.post("/guilds/:guildId/members/:memberId/remove-role", async (request, reply) => {
    const { guildId, memberId } = request.params as { guildId: string; memberId: string };
    const { roleId } = (request.body as any) || {};
    const client = (request as any).client;
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.MANAGE_ROLES);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      const member = await guild.members.fetch(memberId).catch(() => null);
      if (!member) return reply.status(404).send({ error: "Membre introuvable sur Discord" });

      const role = guild.roles.cache.get(roleId);
      if (!role) return reply.status(404).send({ error: "Rôle introuvable" });

      await member.roles.remove(role, "Rôle retiré depuis le dashboard");

      await logBotAction(prisma, guildId, "ROLE_REMOVE", {
        targetId: memberId,
        targetName: member.user.tag,
        reason: `Rôle retiré: ${role.name}`,
        details: { roleId, roleName: role.name },
      });

      await logAudit(prisma, discordId!, "REMOVE_ROLE", {
        guildId,
        targetId: memberId,
        metadata: { roleId, roleName: role.name },
      });

      return reply.send({ success: true, message: `Rôle "${role.name}" retiré de ${member.user.tag}` });
    } catch (e: any) {
      console.error("Remove role error:", e);
      return reply.status(500).send({ error: e.message });
    }
  });

  app.post("/guilds/:guildId/lockdown", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const { active } = (request.body as any) || {};
    const client = (request as any).client;
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.MANAGE_GUILD);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

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

      await logAudit(prisma, discordId!, active ? "LOCKDOWN_ON" : "LOCKDOWN_OFF", {
        guildId,
        metadata: { channelCount: guild.channels.cache.size },
      });

      return reply.send({ success: true, message: active ? "Lockdown activé" : "Lockdown désactivé" });
    } catch (e: any) {
      console.error("Lockdown error:", e);
      return reply.status(500).send({ error: e.message });
    }
  });

  app.post("/guilds/:guildId/members/:memberId/roles", async (request, reply) => {
    const { guildId, memberId } = request.params as { guildId: string; memberId: string };
    const { action, roleId } = (request.body as any) || {};
    const client = (request as any).client;
    const prisma = (request as any).prisma;
    const discordId = (await getDiscordIdFromRequest(request)) ?? undefined;

    try {
      await requirePermission(prisma, discordId, guildId, DASHBOARD_PERMISSIONS.MANAGE_ROLES);
    } catch {
      return reply.status(403).send({ error: "Permission insuffisante" });
    }

    try {
      if (!client) return reply.status(500).send({ error: "Client Discord non connecté" });

      const guild = await client.guilds.fetch(guildId);
      if (!guild) return reply.status(404).send({ error: "Serveur introuvable" });

      const member = await guild.members.fetch(memberId).catch(() => null);
      if (!member) return reply.status(404).send({ error: "Membre introuvable" });

      const role = guild.roles.cache.get(roleId);
      if (!role) return reply.status(404).send({ error: "Rôle introuvable" });

      if (action === "add") {
        await member.roles.add(role, "Ajouté depuis le dashboard");
        await logBotAction(prisma, guildId, "ROLE_ADD", {
          targetId: memberId,
          targetName: member.user.tag,
          reason: `Rôle @${role.name} ajouté`,
        });
        await logAudit(prisma, discordId!, "ADD_ROLE", {
          guildId,
          targetId: memberId,
          metadata: { roleId, roleName: role.name },
        });
        return reply.send({ success: true, message: `Rôle @${role.name} ajouté` });
      } else if (action === "remove") {
        await member.roles.remove(role, "Retiré depuis le dashboard");
        await logBotAction(prisma, guildId, "ROLE_REMOVE", {
          targetId: memberId,
          targetName: member.user.tag,
          reason: `Rôle @${role.name} retiré`,
        });
        await logAudit(prisma, discordId!, "REMOVE_ROLE", {
          guildId,
          targetId: memberId,
          metadata: { roleId, roleName: role.name },
        });
        return reply.send({ success: true, message: `Rôle @${role.name} retiré` });
      }

      return reply.status(400).send({ error: "Action invalide" });
    } catch (e: any) {
      console.error("Roles error:", e);
      return reply.status(500).send({ error: e.message });
    }
  });
}