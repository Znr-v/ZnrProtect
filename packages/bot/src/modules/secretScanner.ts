import { createHash } from "crypto";
import { Message } from "discord.js";
import { BotContext } from "../index";

// Regex patterns for secrets — designed to match common formats
const SECRET_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "discord_token", regex: /[MN][A-Za-z\d]{23,28}\.[A-Za-z\d-_]{6}\.[A-Za-z\d-_]{27,40}/g },
  { name: "discord_webhook", regex: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/gi },
  { name: "github_token", regex: /gh[ps]_[A-Za-z0-9_]{36,255}/g },
  { name: "github_token_classic", regex: /github_pat_[A-Za-z0-9_]{22,255}/g },
  { name: "openai_key", regex: /sk-[A-Za-z0-9]{20,}/g },
  { name: "anthropic_key", regex: /sk-ant-[A-Za-z0-9-_]{20,}/g },
  { name: "aws_access_key", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "jwt", regex: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]+/g },
  { name: "private_key", regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g },
  { name: "generic_api_key", regex: /(?:api[_-]?key|apikey|api[_-]?secret)[\s]*[=:]\s*["']?([A-Za-z0-9_\-]{20,})["']?/gi },
];

export async function checkSecrets(ctx: BotContext, message: Message) {
  if (!message.guild) return;

  const config = await ctx.prisma.guildConfig.findUnique({
    where: { guildId: message.guild.id },
  });
  if (!config?.secretScanEnabled) return;

  const content = message.content;
  if (content.length < 20) return;

  for (const pattern of SECRET_PATTERNS) {
    const matches = content.match(pattern.regex);
    if (!matches) continue;

    // Delete immediately
    try {
      await message.delete();
    } catch {}

    // Hash the secret (never store raw)
    const secretHash = createHash("sha256").update(matches[0]).digest("hex");

    // Alert the author privately
    try {
      await message.author.send(
        `🔐 **Alerte sécurité** dans **${message.guild.name}**\n\n` +
          `Ton message a été supprimé car il contenait un secret de type **${pattern.name}**.\n` +
          `Si c'est un vrai secret, **change-le immédiatement** — il a pu être vu.\n\n` +
          `Le secret n'a pas été sauvegardé.`
      );
    } catch {}

    // Log in DB
    await ctx.prisma.detectedSecret.create({
      data: {
        guildId: message.guild.id,
        actorId: message.author.id,
        channelId: message.channel.id,
        secretType: pattern.name,
        secretHash,
      },
    });

    await ctx.prisma.securityEvent.create({
      data: {
        guildId: message.guild.id,
        type: "SECRET_LEAKED",
        severity: "CRITICAL",
        actorId: message.author.id,
        channelId: message.channel.id,
        description: `Secret détecté: ${pattern.name} — message supprimé`,
        metadata: { type: pattern.name, hashPrefix: secretHash.slice(0, 8) },
      },
    });

    return; // Stop after first match
  }
}
