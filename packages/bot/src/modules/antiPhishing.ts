import { Message } from "discord.js";
import { BotContext } from "../index";

// Known phishing target domains
const LEGIT_DOMAINS = [
  "discord.com", "discord.gg", "discordapp.com",
  "steam.com", "steampowered.com", "steamcommunity.com",
  "epicgames.com", "github.com", "google.com",
  "microsoft.com", "binance.com", "coinbase.com",
];

// Common phishing patterns
const PHISHING_PATTERNS = [
  /d[il1][sc][co0]rd[\w-]*\.(com|gift|gg|org|net|info)/i,
  /st[e3][a4]m[\w-]*\.(com|org|net|info)/i,
  /fr[e3][e3][\w-]*n[i1]tro/i,
  /claim[\w-]*gift/i,
  /free[\w-]*nitro/i,
];

const URL_REGEX = /https?:\/\/[^\s<>]+/gi;
const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd",
  "buff.ly", "ow.ly", "short.io", "rb.gy",
]);

export async function checkPhishing(ctx: BotContext, message: Message) {
  if (!message.guild) return;

  const config = await ctx.prisma.guildConfig.findUnique({
    where: { guildId: message.guild.id },
  });
  if (!config?.phishingEnabled) return;

  const urls = message.content.match(URL_REGEX);
  if (!urls || urls.length === 0) return;

  for (const url of urls) {
    const result = analyzeUrl(url);
    if (!result.suspicious) continue;

    // Delete message
    try {
      await message.delete();
    } catch {}

    // Quarantine user
    if (config.quarantineEnabled && config.quarantineRoleId) {
      try {
        const member = message.member;
        const role = message.guild.roles.cache.get(config.quarantineRoleId);
        if (member && role) {
          await member.roles.add(role, "Lien de phishing détecté");
          await ctx.prisma.member.updateMany({
            where: { discordId: message.author.id, guildId: message.guild.id },
            data: { quarantined: true },
          });
        }
      } catch {}
    }

    // Alert author
    try {
      await message.author.send(
        `⚠️ Ton message dans **${message.guild.name}** a été supprimé car il contenait un lien suspect:\n` +
          `\`${url}\`\n` +
          `Raison: ${result.reason}\n\n` +
          `Si c'est une erreur, contacte un modérateur.`
      );
    } catch {}

    // Log
    await ctx.prisma.detectedLink.create({
      data: {
        guildId: message.guild.id,
        url: url.slice(0, 500),
        domain: result.domain,
        actorId: message.author.id,
        channelId: message.channel.id,
        reason: result.reason,
        confidence: result.confidence,
        metadata: { analysis: result },
      },
    });

    await ctx.prisma.securityEvent.create({
      data: {
        guildId: message.guild.id,
        type: "PHISHING_LINK",
        severity: result.confidence >= 0.8 ? "HIGH" : "MEDIUM",
        actorId: message.author.id,
        channelId: message.channel.id,
        description: `Lien suspect: ${result.domain} — ${result.reason}`,
        metadata: { url: url.slice(0, 200), ...result },
      },
    });

    // Update member stats
    await ctx.prisma.member.updateMany({
      where: { discordId: message.author.id, guildId: message.guild.id },
      data: { linkCount: { increment: 1 }, warnCount: { increment: 1 } },
    });

    return; // One detection per message is enough
  }
}

function analyzeUrl(raw: string): {
  suspicious: boolean;
  reason: string;
  domain: string;
  confidence: number;
} {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { suspicious: false, reason: "", domain: "", confidence: 0 };
  }

  const domain = url.hostname.toLowerCase();

  // Check shorteners
  if (SHORTENERS.has(domain)) {
    return {
      suspicious: true,
      reason: "Raccourcisseur d'URL suspect",
      domain,
      confidence: 0.5,
    };
  }

  // Check punycode
  if (domain.startsWith("xn--")) {
    return {
      suspicious: true,
      reason: "Domaine punycode (homoglyphe potentiel)",
      domain,
      confidence: 0.8,
    };
  }

  // Check regex patterns
  for (const pattern of PHISHING_PATTERNS) {
    if (pattern.test(raw)) {
      // Exclude legitimate domains
      if (LEGIT_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
        continue;
      }
      return {
        suspicious: true,
        reason: "Pattern de phishing connu",
        domain,
        confidence: 0.85,
      };
    }
  }

  // Check typosquatting (Levenshtein distance <= 2 from legit domains)
  for (const legit of LEGIT_DOMAINS) {
    if (domain === legit || domain.endsWith(`.${legit}`)) continue;
    const dist = levenshtein(domain.replace(/\.[^.]+$/, ""), legit.replace(/\.[^.]+$/, ""));
    if (dist > 0 && dist <= 2) {
      return {
        suspicious: true,
        reason: `Typosquatting probable de ${legit}`,
        domain,
        confidence: 0.75,
      };
    }
  }

  return { suspicious: false, reason: "", domain, confidence: 0 };
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}
