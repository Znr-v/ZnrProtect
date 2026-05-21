import { Guild, GuildMember, Role, PermissionsBitField, ChannelType } from "discord.js";
import { BotContext } from "../index";
import { ActionType } from "@prisma/client";
import { logBotAction } from "../lib/botLogs";

const QUARANTINE_ROLE_NAME = "Quarantaine";
const QUARANTINE_ROLE_COLOR = "#FF4444";

export async function getQuarantineRoleId(guild: Guild): Promise<string | null> {
  const role = guild.roles.cache.find(r => r.name === QUARANTINE_ROLE_NAME);
  return role?.id || null;
}

export async function ensureQuarantineRole(ctx: BotContext, guild: Guild): Promise<Role> {
  let role = guild.roles.cache.find(r => r.name === QUARANTINE_ROLE_NAME);
  
  if (!role) {
    role = await guild.roles.create({
      name: QUARANTINE_ROLE_NAME,
      color: QUARANTINE_ROLE_COLOR,
      permissions: new PermissionsBitField([]),
      reason: "Auto-creation du rôle de quarantaine",
      hoist: false,
    });
    console.log(`[QUARANTINE] Rôle créé: ${role.name} (${role.id})`);
    
    // Set channel permissions once when role is first created
    await setQuarantineChannelPermissions(guild, role).catch(() => {});
  }
  
  return role;
}

export function hasQuarantineRole(member: GuildMember): boolean {
  return member.roles.cache.some(r => r.name === QUARANTINE_ROLE_NAME);
}

export async function setQuarantineChannelPermissions(guild: Guild, quarantineRole: Role) {
  for (const [, channel] of guild.channels.cache) {
    if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice) {
      try {
        await channel.permissionOverwrites.edit(quarantineRole, {
          SendMessages: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
          SendMessagesInThreads: false,
          ViewChannel: false,
          Connect: false,
          Speak: false,
          Stream: false,
        });
      } catch {}
    }
  }
}

export async function applyQuarantine(
  ctx: BotContext,
  member: GuildMember,
  reason: string = "Quarantaine automatique",
  byModerator: string = "AUTO"
): Promise<boolean> {
  const guild = member.guild;
  const guildId = guild.id;
  
  // Store current roles (excluding @everyone)
  const currentRoles = member.roles.cache
    .filter(r => r.id !== guild.id)
    .map(r => r.id);
  
  try {
    const quarantineRole = await ensureQuarantineRole(ctx, guild);
    
    // Replace all roles with quarantine role in a single API call
    await member.roles.set([quarantineRole.id], reason);
    
    // Store in DB
    await ctx.prisma.quarantinedMember.upsert({
      where: { guildId_discordId: { guildId, discordId: member.id } },
      create: {
        guildId,
        discordId: member.id,
        username: member.user.tag,
        roles: currentRoles,
        quarantinedBy: byModerator,
      },
      update: {},
    });
    
    await ctx.prisma.member.updateMany({
      where: { discordId: member.id, guildId },
      data: { quarantined: true },
    });
    
    console.log(`[QUARANTINE] ✅ ${member.user.tag} mis en quarantine. Rôles retirés: ${currentRoles.length}`);
    
    logBotAction(ctx.prisma, guildId, "QUARANTINE_APPLY", {
      targetId: member.id,
      targetName: member.user.tag,
      executedBy: byModerator === "AUTO" ? "bot" : "moderator",
      moderatorId: byModerator !== "AUTO" ? byModerator : undefined,
      reason,
      details: { rolesSaved: currentRoles.length, roles: currentRoles },
    });
    
    return true;
  } catch (error) {
    console.error(`[QUARANTINE] ❌ Erreur pour ${member.user.tag}:`, error);
    return false;
  }
}

export async function liftQuarantine(
  ctx: BotContext,
  member: GuildMember,
  reason: string = "Quarantaine levée",
  markTrusted: boolean = true
): Promise<boolean> {
  const guildId = member.guild.id;
  const discordId = member.id;
  
  // Get stored roles
  const quarantineRecord = await ctx.prisma.quarantinedMember.findUnique({
    where: { guildId_discordId: { guildId, discordId } },
  });
  
  if (!quarantineRecord) {
    console.log(`[QUARANTINE] ${member.user.tag} n'est pas en quarantine`);
    return false;
  }
  
  const quarantineRole = member.guild.roles.cache.find(r => r.name === QUARANTINE_ROLE_NAME);
  const originalRoles = quarantineRecord.roles;
  
  try {
    await ctx.prisma.$transaction(async (tx) => {
      // 1. Remove quarantine role
      if (quarantineRole && member.roles.cache.has(quarantineRole.id)) {
        await member.roles.remove(quarantineRole, reason);
      }
      
      // 2. Restore original roles (filter out quarantine role if still in list)
      const rolesToRestore = originalRoles.filter(id => id !== quarantineRole?.id);
      
      if (rolesToRestore.length > 0) {
        const roles = rolesToRestore
          .map(id => member.guild.roles.cache.get(id))
          .filter((r): r is Role => r !== undefined);
        
        if (roles.length > 0) {
          await member.roles.add(roles, reason);
        }
      }
      
      // 3. Delete quarantine record
      await tx.quarantinedMember.delete({
        where: { guildId_discordId: { guildId, discordId } },
      });
      
      // 4. Update member record
      if (markTrusted) {
        await tx.member.updateMany({
          where: { discordId, guildId },
          data: { quarantined: false, trusted: true, riskScore: 0 },
        });
      } else {
        await tx.member.updateMany({
          where: { discordId, guildId },
          data: { quarantined: false },
        });
      }
    });
    
    console.log(`[QUARANTINE] ✅ Quarantaine levée pour ${member.user.tag}. Rôles restaurés: ${originalRoles.length}`);
    
    logBotAction(ctx.prisma, guildId, "QUARANTINE_LIFT", {
      targetId: member.id,
      targetName: member.user.tag,
      executedBy: "bot",
      reason,
      details: { rolesRestored: originalRoles.length, markTrusted },
    });
    
    return true;
  } catch (error) {
    console.error(`[QUARANTINE] ❌ Erreur pour ${member.user.tag}:`, error);
    return false;
  }
}

export async function executeSanction(
  ctx: BotContext,
  member: GuildMember,
  action: ActionType,
  reason: string,
  timeoutMinutes?: number
): Promise<boolean> {
  const guild = member.guild;
  const guildId = guild.id;
  
  switch (action) {
    case "QUARANTINE":
      try {
        return await applyQuarantine(ctx, member, reason);
      } catch (e) {
        console.error(`[SANCTION] Quarantine failed:`, e);
        return false;
      }
      
    case "BAN":
      try {
        await member.ban({ reason, deleteMessageSeconds: 86400 });
        await ctx.prisma.member.updateMany({
          where: { discordId: member.id, guildId },
          data: { quarantined: false },
        });
        logBotAction(ctx.prisma, guildId, "BAN", {
          targetId: member.id,
          targetName: member.user.tag,
          executedBy: "bot",
          reason,
          details: { deleteMessages: true },
        });
        return true;
      } catch (e) {
        console.error(`[SANCTION] Ban failed:`, e);
        return false;
      }
      
    case "KICK":
      try {
        await member.kick(reason);
        logBotAction(ctx.prisma, guildId, "KICK", {
          targetId: member.id,
          targetName: member.user.tag,
          executedBy: "bot",
          reason,
        });
        return true;
      } catch (e) {
        console.error(`[SANCTION] Kick failed:`, e);
        return false;
      }
      
    case "KICK_DELETE":
      try {
        await member.send(`Vous avez été exclu de ${guild.name} pour: ${reason}`).catch(() => {});
        await member.kick(reason);
        logBotAction(ctx.prisma, guildId, "KICK", {
          targetId: member.id,
          targetName: member.user.tag,
          executedBy: "bot",
          reason,
          details: { notifyUser: true },
        });
        return true;
      } catch (e) {
        console.error(`[SANCTION] Kick failed:`, e);
        return false;
      }
      
    case "TIMEOUT":
    default:
      try {
        const duration = (timeoutMinutes || 5) * 60 * 1000;
        await member.timeout(duration, reason);
        const timeoutUntil = new Date(Date.now() + duration);
        await ctx.prisma.member.updateMany({
          where: { discordId: member.id, guildId },
          data: { timedOutUntil: timeoutUntil },
        });
        logBotAction(ctx.prisma, guildId, "TIMEOUT", {
          targetId: member.id,
          targetName: member.user.tag,
          executedBy: "bot",
          reason,
          details: { durationMinutes: timeoutMinutes || 5, timeoutUntil },
        });
        return true;
      } catch (e) {
        console.error(`[SANCTION] Timeout failed:`, e);
        return false;
      }
  }
}