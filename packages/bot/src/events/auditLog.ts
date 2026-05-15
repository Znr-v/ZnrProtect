import { AuditLogEvent, Guild, GuildAuditLogsEntry } from "discord.js";
import { BotContext } from "../index";

const DANGEROUS_EVENTS = new Set([
  AuditLogEvent.RoleUpdate,
  AuditLogEvent.RoleCreate,
  AuditLogEvent.ChannelDelete,
  AuditLogEvent.WebhookCreate,
  AuditLogEvent.MemberRoleUpdate,
  AuditLogEvent.BotAdd,
  AuditLogEvent.MemberBanAdd,
  AuditLogEvent.MemberKick,
]);

export async function onGuildAuditLogEntryCreate(
  ctx: BotContext,
  entry: GuildAuditLogsEntry,
  guild: Guild
) {
  if (!DANGEROUS_EVENTS.has(entry.action)) return;

  // Permission drift detection for role changes
  if (entry.action === AuditLogEvent.RoleUpdate && entry.changes) {
    for (const change of entry.changes) {
      if (change.key === "permissions") {
        const oldPerms = BigInt(change.old as string || "0");
        const newPerms = BigInt(change.new as string || "0");
        const added = newPerms & ~oldPerms;

        // Check if dangerous perms were added
        const DANGEROUS_PERMS = {
          ADMINISTRATOR: 1n << 3n,
          MANAGE_GUILD: 1n << 5n,
          MANAGE_ROLES: 1n << 28n,
          MANAGE_WEBHOOKS: 1n << 29n,
          MENTION_EVERYONE: 1n << 17n,
        };

        const flaggedPerms: string[] = [];
        for (const [name, bit] of Object.entries(DANGEROUS_PERMS)) {
          if (added & bit) flaggedPerms.push(name);
        }

        if (flaggedPerms.length > 0) {
          await ctx.prisma.permissionChange.create({
            data: {
              guildId: guild.id,
              roleId: entry.targetId || "unknown",
              roleName: entry.target?.toString() || "unknown",
              changeType: "modified",
              permission: flaggedPerms.join(", "),
              changedBy: entry.executorId || undefined,
              flagged: true,
            },
          });

          await ctx.prisma.securityEvent.create({
            data: {
              guildId: guild.id,
              type: "ROLE_ESCALATION",
              severity: flaggedPerms.includes("ADMINISTRATOR") ? "CRITICAL" : "HIGH",
              actorId: entry.executorId || undefined,
              description: `Permission drift: ${flaggedPerms.join(", ")} ajoutée(s)`,
              metadata: { roleId: entry.targetId, permissions: flaggedPerms },
            },
          });
        }
      }
    }
  }

  // Mass ban/kick detection
  if (entry.action === AuditLogEvent.MemberBanAdd || entry.action === AuditLogEvent.MemberKick) {
    const executorId = entry.executorId;
    if (!executorId) return;

    const key = `modactions:${guild.id}:${executorId}`;
    const now = Date.now();
    await ctx.redis.zadd(key, now, `${entry.action}:${now}`);
    await ctx.redis.expire(key, 300);

    const recentCount = await ctx.redis.zcount(key, now - 60_000, now);
    if (recentCount >= 5) {
      await ctx.prisma.securityEvent.create({
        data: {
          guildId: guild.id,
          type: entry.action === AuditLogEvent.MemberBanAdd ? "MASS_BAN" : "MASS_KICK",
          severity: "CRITICAL",
          actorId: executorId,
          description: `${recentCount} actions de modération en 60s par <@${executorId}>`,
          metadata: { count: recentCount, action: entry.action },
        },
      });
    }
  }

  // Channel deletion tracking
  if (entry.action === AuditLogEvent.ChannelDelete) {
    await ctx.prisma.securityEvent.create({
      data: {
        guildId: guild.id,
        type: "CHANNEL_DELETE",
        severity: "MEDIUM",
        actorId: entry.executorId || undefined,
        description: `Salon supprimé: ${entry.target?.toString() || "inconnu"}`,
        metadata: { targetId: entry.targetId },
      },
    });
  }

  // Webhook creation tracking
  if (entry.action === AuditLogEvent.WebhookCreate) {
    await ctx.prisma.securityEvent.create({
      data: {
        guildId: guild.id,
        type: "WEBHOOK_CREATED",
        severity: "MEDIUM",
        actorId: entry.executorId || undefined,
        description: `Webhook créé par <@${entry.executorId}>`,
        metadata: { targetId: entry.targetId },
      },
    });
  }

  // Bot addition
  if (entry.action === AuditLogEvent.BotAdd) {
    await ctx.prisma.securityEvent.create({
      data: {
        guildId: guild.id,
        type: "PERMISSION_CHANGE",
        severity: "HIGH",
        actorId: entry.executorId || undefined,
        description: `Bot ajouté: <@${entry.targetId}> par <@${entry.executorId}>`,
        metadata: { botId: entry.targetId },
      },
    });
  }
}
