-- CreateTable
CREATE TABLE "GuildRole" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "discordRoleId" TEXT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#99AAb5',
    "position" INTEGER NOT NULL DEFAULT 0,
    "discordPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "panelPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildRole_guildId_discordRoleId_key" ON "GuildRole"("guildId", "discordRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildRole_guildId_name_key" ON "GuildRole"("guildId", "name");

-- AddForeignKey
ALTER TABLE "GuildRole" ADD CONSTRAINT "GuildRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
