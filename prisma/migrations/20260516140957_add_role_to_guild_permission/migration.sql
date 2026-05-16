-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('RAID_DETECTED', 'SPAM_DETECTED', 'PHISHING_LINK', 'SECRET_LEAKED', 'PERMISSION_CHANGE', 'SUSPICIOUS_JOIN', 'MASS_BAN', 'MASS_KICK', 'CHANNEL_DELETE', 'WEBHOOK_CREATED', 'WEBHOOK_SPAM', 'ROLE_ESCALATION', 'MODERATOR_ANOMALY', 'CANARY_TRIGGERED', 'EMERGENCY_ACTIVATED', 'QUARANTINE_APPLIED', 'INVITE_SUSPICIOUS');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CONTAINED', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "DashboardRole" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'VIEWER');

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "lockdownActive" BOOLEAN NOT NULL DEFAULT false,
    "lockdownAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildConfig" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "raidJoinThreshold" INTEGER NOT NULL DEFAULT 10,
    "raidJoinWindow" INTEGER NOT NULL DEFAULT 60,
    "raidAutoLockdown" BOOLEAN NOT NULL DEFAULT true,
    "raidMinAccountAge" INTEGER NOT NULL DEFAULT 3,
    "spamMaxMessages" INTEGER NOT NULL DEFAULT 5,
    "spamMaxMessages10s" INTEGER NOT NULL DEFAULT 8,
    "spamRepeatThreshold" INTEGER NOT NULL DEFAULT 3,
    "spamMaxMentions" INTEGER NOT NULL DEFAULT 3,
    "spamMaxMentions10s" INTEGER NOT NULL DEFAULT 5,
    "spamMuteDuration" INTEGER NOT NULL DEFAULT 5,
    "spamAutoDelete" BOOLEAN NOT NULL DEFAULT true,
    "phishingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "phishingCheckRedirects" BOOLEAN NOT NULL DEFAULT true,
    "secretScanEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scanBots" BOOLEAN NOT NULL DEFAULT false,
    "quarantineRoleId" TEXT,
    "quarantineEnabled" BOOLEAN NOT NULL DEFAULT true,
    "strictChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relaxedChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emergencyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotActionLog" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "targetName" TEXT,
    "moderatorId" TEXT,
    "moderatorName" TEXT,
    "reason" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountAge" TIMESTAMP(3) NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "quarantined" BOOLEAN NOT NULL DEFAULT false,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "linkCount" INTEGER NOT NULL DEFAULT 0,
    "warnCount" INTEGER NOT NULL DEFAULT 0,
    "timedOutUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "severity" "EventSeverity" NOT NULL,
    "actorId" TEXT,
    "channelId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "incidentId" TEXT,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "EventSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'NEW',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentAction" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "executedBy" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskScore" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "factors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "condition" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "shadowMode" BOOLEAN NOT NULL DEFAULT false,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleMatch" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "actorId" TEXT,
    "channelId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "shadow" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditSnapshot" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionChange" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "changedBy" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectedLink" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetectedLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectedSecret" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "secretType" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetectedSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigVersion" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanaryChannel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'honeypot',
    "triggers" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanaryChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEntry" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdBy" TEXT,
    "name" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteStats" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "inviterId" TEXT,
    "usesTotal" INTEGER NOT NULL DEFAULT 0,
    "usesSuspicious" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InviteStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardUser" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar" TEXT,
    "role" "DashboardRole" NOT NULL DEFAULT 'VIEWER',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "DashboardUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardGuildPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "role" "DashboardRole" NOT NULL DEFAULT 'VIEWER',
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardGuildPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "guildId" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildConfig_guildId_key" ON "GuildConfig"("guildId");

-- CreateIndex
CREATE INDEX "BotActionLog_guildId_createdAt_idx" ON "BotActionLog"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "Member_guildId_riskScore_idx" ON "Member"("guildId", "riskScore");

-- CreateIndex
CREATE UNIQUE INDEX "Member_discordId_guildId_key" ON "Member"("discordId", "guildId");

-- CreateIndex
CREATE INDEX "SecurityEvent_guildId_createdAt_idx" ON "SecurityEvent"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_type_severity_idx" ON "SecurityEvent"("type", "severity");

-- CreateIndex
CREATE INDEX "Incident_guildId_status_idx" ON "Incident"("guildId", "status");

-- CreateIndex
CREATE INDEX "RiskScore_memberId_createdAt_idx" ON "RiskScore"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "Rule_guildId_enabled_idx" ON "Rule"("guildId", "enabled");

-- CreateIndex
CREATE INDEX "RuleMatch_ruleId_createdAt_idx" ON "RuleMatch"("ruleId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditSnapshot_guildId_createdAt_idx" ON "AuditSnapshot"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "PermissionChange_guildId_createdAt_idx" ON "PermissionChange"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "DetectedLink_guildId_createdAt_idx" ON "DetectedLink"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "DetectedLink_domain_idx" ON "DetectedLink"("domain");

-- CreateIndex
CREATE INDEX "DetectedSecret_guildId_createdAt_idx" ON "DetectedSecret"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "ConfigVersion_guildId_createdAt_idx" ON "ConfigVersion"("guildId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CanaryChannel_guildId_channelId_key" ON "CanaryChannel"("guildId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEntry_guildId_webhookId_key" ON "WebhookEntry"("guildId", "webhookId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteStats_guildId_inviteCode_key" ON "InviteStats"("guildId", "inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardUser_discordId_key" ON "DashboardUser"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardGuildPermission_userId_guildId_key" ON "DashboardGuildPermission"("userId", "guildId");

-- AddForeignKey
ALTER TABLE "GuildConfig" ADD CONSTRAINT "GuildConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotActionLog" ADD CONSTRAINT "BotActionLog_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAction" ADD CONSTRAINT "IncidentAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScore" ADD CONSTRAINT "RiskScore_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleMatch" ADD CONSTRAINT "RuleMatch_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSnapshot" ADD CONSTRAINT "AuditSnapshot_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionChange" ADD CONSTRAINT "PermissionChange_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedLink" ADD CONSTRAINT "DetectedLink_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedSecret" ADD CONSTRAINT "DetectedSecret_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigVersion" ADD CONSTRAINT "ConfigVersion_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanaryChannel" ADD CONSTRAINT "CanaryChannel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEntry" ADD CONSTRAINT "WebhookEntry_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteStats" ADD CONSTRAINT "InviteStats_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardGuildPermission" ADD CONSTRAINT "DashboardGuildPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DashboardUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
