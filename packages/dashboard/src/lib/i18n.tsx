"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { apiFetch, setAuthToken } from "./api";

export type Language = "fr" | "en";

export const translations = {
  fr: {
    // Navbar
    servers: "Serveurs",
    logout: "Déconnexion",
    loginWithDiscord: "Connexion avec Discord",
    // Dashboard Home
    dashboard: "Tableau de bord",
    monitoredServers: "serveurs surveillés",
    monitoredServer: "serveur surveillé",
    yourServers: "Vos serveurs",
    lockdownActive: "LOCKDOWN ACTIF",
    members: "membres",
    incidents: "incidents",
    events: "events",
    manageStaff: "Gérer le staff",
    noServerAccess: "Aucun serveur accessible",
    contactAdminForAccess: "Contactez un administrateur pour obtenir des accès.",
    antiRaid: "Anti-Raid",
    antiRaidDesc: "Détection intelligente des raids et lockdown automatique.",
    antiPhishing: "Anti-Phishing",
    antiPhishingDesc: "Analyse de liens, typosquatting et punycode en temps réel.",
    secretScanner: "Secret Scanner",
    secretScannerDesc: "Détection de tokens, clés API et secrets dans les messages.",
    unauthorizedAccess: "Accès non autorisé",
    unauthorizedAccessDesc: "Votre compte est connecté mais vous n'avez accès à aucun serveur. Contactez un administrateur.",
    whatToDo: "Que faire ?",
    whatToDoDesc1: "Demandez à un administrateur de vous ajouter au dashboard",
    whatToDoDesc2: "Un administrateur doit vous assigner des permissions sur un serveur",
    // Stat Card labels
    statServers: "Serveurs",
    statMembers: "Membres",
    statEvents24h: "Events (24h)",
    statOpenIncidents: "Incidents ouverts",
    statHighRiskMembers: "Membres à risque",
    statPhishing7d: "Phishing (7j)",
    statSecrets7d: "Secrets (7j)",
    statEvents7d: "Events (7j)",
    // Hero & general
    heroDesc: "Surveillez, analysez et protégez vos serveurs Discord en temps réel.",
    loading: "Chargement...",
    // Tabs
    tabOverview: "Vue d'ensemble",
    tabIncidents: "Incidents",
    tabEvents: "Events",
    tabMembers: "Membres",
    tabLogs: "Logs",
    tabConfig: "Config",
    tabRoles: "Rôles",
    // Config page
    roleManagement: "Gestion des rôles et permissions",
    panelRoles: "Rôles Panel",
    discordRoles: "Rôles Discord",
    sync: "Synchroniser",
    addRole: "Ajouter un rôle",
    newRoleName: "Nom du rôle",
    color: "Couleur",
    save: "Sauvegarder",
    cancel: "Annuler",
    delete: "Supprimer",
    confirm: "Confirmer",
    confirmDeleteRole: "Supprimer ce rôle ?",
    add: "Ajouter",
    panelRolesTitle: "Rôles du Panel",
    panelRolesDesc: "Créez des rôles pour organiser les permissions dans le dashboard. Ces rôles sont différents des rôles Discord.",
    discordRolesDesc: "Ces rôles sont synchronisés avec les rôles du serveur Discord. Configurez les permissions Panel pour chaque rôle Discord.",
    newDiscordRoleTitle: "Nouveau rôle Discord",
    newPanelRoleTitle: "Nouveau rôle Panel",
    discordPermissionsLabel: "Permissions Discord :",
    panelPermissionsLabel: "Permissions Panel :",
    createRoleBtn: "Créer le rôle",
    noPanelRolesConfigured: "Aucun rôle panel configuré",
    noDiscordRolesConfigured: "Aucun rôle Discord configuré. Synchronisez pour importer les rôles.",
    createCustomRoleBtn: "Créer un rôle personnalisé",
    creatingLabel: "Création...",
    createDefaultRolesBtn: "Créer les rôles par défaut (Owner, Admin, Mod, Viewer)",
    syncWithDiscordBtn: "Synchroniser avec Discord",
    showSeparatelyLabel: "Afficher séparément dans la liste des membres",
    discordSuffix: "(Discord)",
    noPermissionLabel: "Aucune permission",
    editTooltip: "Modifier",
    deleteTooltip: "Supprimer",
    confirmDeleteRoleTitle: "Supprimer le rôle",
    confirmDeleteRoleDesc: "Cette action est irréversible. Le rôle sera supprimé.",
    changeColorTooltip: "Changer la couleur",
    exHelperPlaceholder: "Ex: Helper",
    exModeratorPlaceholder: "Ex: Modérateur",
    errorLoadingRoles: "Erreur lors du chargement des rôles",
    // Staff/Admin
    staffMembers: "Membres du Staff",
    searchOrAddUser: "Rechercher ou ajouter un utilisateur",
    allRoles: "Tous les rôles",
    searchAdd: "Chercher / Ajouter",
    user: "Utilisateur",
    role: "Rôle",
    lastLogin: "Dernière connexion",
    actions: "Actions",
    // Unauthorized Page
    accessDenied: "Accès refusé",
    accessDeniedDesc1: "Vous êtes connecté en tant que ",
    accessDeniedDesc2: ", mais vous n'avez pas les permissions nécessaires pour accéder à cette page.",
    unauthorizedNextSteps1: "Vérifiez que vous avez le bon rôle",
    unauthorizedNextSteps2: "Contactez un administrateur du bot",
    unauthorizedNextSteps3: "Demandez les permissions requises",
    // Pending Page
    pendingApproval: "En attente d'approbation",
    pendingApprovalDesc1: "Votre compte Discord (",
    pendingApprovalDesc2: ") est connecté, mais vous n'avez pas encore accès au dashboard.",
    nextSteps: "Prochaines étapes",
    pendingNextSteps1: "Un administrateur doit valider votre accès",
    pendingNextSteps2: "Vous recevrez accès une fois votre demande acceptée",
    pendingNextSteps3: "Cette page s'actualisera automatiquement",

    // Member Details & General
    riskScoreLabel: "Score de risque",
    messagesLabel: "Messages",
    mutesLabel: "Mutes",
    kicksLabel: "Kicks",
    bansLabel: "Bans",
    statusLabel: "Statut",
    mutedLabel: "Mute",
    pastMutesLabel: "mute(s) passé(s)",
    bannedLabel: "Banni",
    trustedLabel: "Fiable",
    rolesLabel: "Rôles",
    viewMore: "Voir →",
    viewAllHistory: "Voir tout l'historique",
    backLabel: "Retour",
    muteHistoryLabel: "Historique des mutes",
    noMuteLabel: "Aucun mute",
    durationLabel: "Durée",
    reasonLabel: "Raison",
    endLabel: "Fin",
    inLabel: "dans",
    expiredLabel: "expiré",
    kickHistoryLabel: "Historique des kicks",
    noKickLabel: "Aucun kick",
    byLabel: "Par",
    banHistoryLabel: "Historique des bans",
    noBanLabel: "Aucun ban",
    roleAtBanLabel: "Rôle au moment du ban",
    warningsSanctionsLabel: "Avertissements & Sanctions",
    noWarningLabel: "Aucun avertissement",
    sanctionLabel: "Sanction",
    recentMessagesLabel: "Messages récents",
    loadingMessagesLabel: "Chargement des messages...",
    noMessagesLabel: "Aucun message trouvé",
    emptyMsgMediaLabel: "[Message vide ou média]",
    completeHistoryLabel: "Historique complet",
    riskScoreDetailsLabel: "Détail du score de risque",
    totalScoreLabel: "Score total",
    ptsLabel: "pts",
    scoreFormulaLabel: "Le score est calculé à partir de :",
    accountAgeLabel: "Âge du compte",
    messagesCountLabel: "Nombre de messages",
    suspiciousLinksLabel: "Liens suspects partagés",
    warningsCountLabel: "Avertissements reçus",
    recentBehaviorLabel: "Comportement récent",
    memberRolesLabel: "Rôles du membre",
    loadingLabel: "Chargement...",
    currentRolesLabel: "Rôles actuels",
    addLabel: "Ajouter",
    noRolesLabel: "Aucun rôle",
    removeLabel: "Retirer",
    searchSelectRolePlaceholder: "Rechercher ou sélectionner un rôle...",
    noRolesAvailableLabel: "Aucun rôle disponible",
    cancelLabel: "Annuler",
    confirmLabel: "Confirmer",
    removeRoleConfirmPrompt: "Retirer le rôle",
    fromLabel: "de",

    // Action Labels / Logs Tab
    actionBan: "Banni",
    actionKick: "Exclu",
    actionMute: "Mute",
    actionUnmute: "Mute retiré",
    actionUnban: "Débanni",
    actionTrustAdd: "Marqué fiable",
    actionTrustRemove: "Fiable retiré",
    actionLockdownOn: "Lockdown activé",
    actionLockdownOff: "Lockdown désactivé",
    actionQuarantine: "Mis en quarantaine",
    actionConfigChange: "Config modifiée",
    actionRoleRemove: "Rôle retiré",

    filterBans: "Bans",
    filterKicks: "Kicks",
    filterMutes: "Mutes",
    filterUnmutes: "Démutes",
    filterUnbans: "Débans",
    filterQuarantine: "Quarantaine",
    filterTrust: "Fiable",
    filterConfig: "Config",

    periodAll: "Tout",
    periodToday: "Aujourd'hui",
    periodWeek: "7 jours",
    periodMonth: "30 jours",
    resetLabel: "Réinitialiser",
    resultLabel: "résultat",
    resultsLabel: "résultats",
    noResultsFilters: "Aucun résultat pour ces filtres",
    moderatorLabel: "Modérateur",
    targetLabel: "Cible",
    dateLabel: "Date",
    detailsLabel: "Détails",
    noActionsRecorded: "Aucune action enregistrée",
    searchLogsPlaceholder: "Rechercher dans les logs... (raison, utilisateur, @membre)",
    bannedHistoryLabel: "Historique des bannissements",
    entryLabel: "entrée",
    entriesLabel: "entrées",
    searchHistoryPlaceholder: "Rechercher par pseudo ou raison...",
    allLabel: "Tous",
    unbannedLabel: "Débanni",
    allPeriodLabel: "Toute la période",
    noBanHistoryLabel: "Aucun historique de ban",
    bannedOnLabel: "Banni le",
    unbannedOnLabel: "Débanni le",
    bannedOnlyBtn: "Bannis",
    historyBtn: "Historique",
    searchBannedPlaceholder: "Rechercher dans les bannis...",
    searchMemberPlaceholder: "Rechercher un membre (ou @)...",
    roleAddPlaceholder: "@Ajouter",
    noRolesFoundLabel: "Aucun rôle trouvé",
    memberLabel: "Membre",
    membersLabel: "membres",
    riskLabel: "Risque",
    msgsLabel: "Msgs",
    warnsLabel: "Mutes",
    actionsLabel: "Actions",
    noMembersLabel: "Aucun membre.",
    
    // Overview tab
    securityEventsLabel: "Events securite",
    phishingLinksLabel: "Liens phishing",
    detectedSecretsLabel: "Secrets detectes",
    lockdownLabel: "Lockdown",
    activeLabel: "ACTIF",
    inactiveLabel: "Inactif",
    disableLabel: "Desactiver",
    enableLabel: "Activer",
    
    // Incidents tab
    noIncidentsLabel: "Aucun incident.",
    titleLabel: "Titre",
    channelLabel: "Salon",
    severityLabel: "Severite",
    
    // Event modal / typeLabels
    eventRaidDetected: "Raid detecte",
    eventSpamDetected: "Spam detecte",
    eventPhishingLink: "Lien de phishing",
    eventSecretLeaked: "Secret fuite",
    eventPermissionChange: "Changement permission",
    eventRoleEscalation: "Escalation de roles",
    eventMassBan: "Ban de masse",
    eventMassKick: "Kick de masse",
    eventChannelDelete: "Salon supprime",
    eventWebhookCreated: "Webhook cree",
    eventCanaryTriggered: "Canary declenche",
    eventEmergencyActivated: "Urgence activee",
    eventQuarantineApplied: "Quarantaine appliquee",
    eventModeratorAnomaly: "Anomalie moderateur",
    eventSuspiciousJoin: "Join suspect",
    eventInviteSuspicious: "Invite suspect",
    
    eventModalMember: "Membre",
    eventModalChannel: "Salon",
    eventModalDate: "Date",
    eventModalDetails: "DETAILS",
    eventModalMessages: "Messages detectes",
    loadingEvents: "Chargement des événements...",
    noSecurityEvents: "Aucun event de securite.",
    messagesDetected: "message(s) detecte(s)",
    
    // Incident Modal
    incidentStatusNew: "Nouveau",
    incidentStatusInProgress: "En cours",
    incidentStatusContained: "Contenu",
    incidentStatusResolved: "Résolu",
    incidentStatusFalsePositive: "Faux positif",
    incidentEventsLabel: "Evenements",
    incidentActionsLabel: "Actions",
    incidentCreatedLabel: "Cree le",
    incidentDescriptionLabel: "DESCRIPTION",
    incidentLatestEventsLabel: "DERNIERS EVENEMENTS",
    
    // Member actions modals
    muteUserTitle: "Mute",
    durationMinutesLabel: "Durée (minutes)",
    minuteLabel: "minute",
    minutesLabel: "minutes",
    hourLabel: "heure",
    hoursLabel: "heures",
    dayLabel: "jour",
    daysLabel: "jours",
    sendDmLabel: "Envoyer un message privé",
    confirmMuteBtn: "Confirmer le mute",
    banUserTitle: "Bannir",
    banReasonPlaceholder: "Raison du bannissement...",
    confirmBanBtn: "Confirmer le bannissement",
    kickUserTitle: "Exclure",
    kickReasonPlaceholder: "Raison de l'exclusion...",
    confirmKickBtn: "Confirmer l'exclusion",
  },
  en: {
    // Navbar
    servers: "Servers",
    logout: "Log out",
    loginWithDiscord: "Connect with Discord",
    // Dashboard Home
    dashboard: "Dashboard",
    monitoredServers: "monitored servers",
    monitoredServer: "monitored server",
    yourServers: "Your servers",
    lockdownActive: "LOCKDOWN ACTIVE",
    members: "members",
    incidents: "incidents",
    events: "events",
    manageStaff: "Manage staff",
    noServerAccess: "No accessible servers",
    contactAdminForAccess: "Contact an administrator to request access.",
    antiRaid: "Anti-Raid",
    antiRaidDesc: "Intelligent raid detection and automatic lockdown.",
    antiPhishing: "Anti-Phishing",
    antiPhishingDesc: "Real-time analysis of links, typosquatting and punycode.",
    secretScanner: "Secret Scanner",
    secretScannerDesc: "Detection of tokens, API keys and secrets in messages.",
    unauthorizedAccess: "Unauthorized Access",
    unauthorizedAccessDesc: "Your account is connected but you do not have access to any server. Contact an administrator.",
    whatToDo: "What to do?",
    whatToDoDesc1: "Ask an administrator to add you to the dashboard",
    whatToDoDesc2: "An administrator must assign you permissions on a server",
    // Stat Card labels
    statServers: "Servers",
    statMembers: "Members",
    statEvents24h: "Events (24h)",
    statOpenIncidents: "Open incidents",
    statHighRiskMembers: "At-risk members",
    statPhishing7d: "Phishing (7d)",
    statSecrets7d: "Secrets (7d)",
    statEvents7d: "Events (7d)",
    // Hero & general
    heroDesc: "Monitor, analyze and protect your Discord servers in real time.",
    loading: "Loading...",
    // Tabs
    tabOverview: "Overview",
    tabIncidents: "Incidents",
    tabEvents: "Events",
    tabMembers: "Members",
    tabLogs: "Logs",
    tabConfig: "Config",
    tabRoles: "Roles",
    // Config page
    roleManagement: "Role and permission management",
    panelRoles: "Panel Roles",
    discordRoles: "Discord Roles",
    sync: "Sync",
    addRole: "Add Role",
    newRoleName: "Role Name",
    color: "Color",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirm: "Confirm",
    confirmDeleteRole: "Delete this role?",
    add: "Add",
    panelRolesTitle: "Panel Roles",
    panelRolesDesc: "Create roles to organize permissions in the dashboard. These roles are different from Discord roles.",
    discordRolesDesc: "These roles are synchronized with the Discord server roles. Configure Panel permissions for each Discord role.",
    newDiscordRoleTitle: "New Discord Role",
    newPanelRoleTitle: "New Panel Role",
    discordPermissionsLabel: "Discord Permissions:",
    panelPermissionsLabel: "Panel Permissions:",
    createRoleBtn: "Create role",
    noPanelRolesConfigured: "No panel roles configured",
    noDiscordRolesConfigured: "No Discord roles configured. Sync to import roles.",
    createCustomRoleBtn: "Create a custom role",
    creatingLabel: "Creating...",
    createDefaultRolesBtn: "Create default roles (Owner, Admin, Mod, Viewer)",
    syncWithDiscordBtn: "Sync with Discord",
    showSeparatelyLabel: "Show separately in members list",
    discordSuffix: "(Discord)",
    noPermissionLabel: "No permission",
    editTooltip: "Edit",
    deleteTooltip: "Delete",
    confirmDeleteRoleTitle: "Delete role",
    confirmDeleteRoleDesc: "This action is irreversible. The role will be deleted.",
    changeColorTooltip: "Change color",
    exHelperPlaceholder: "e.g. Helper",
    exModeratorPlaceholder: "e.g. Moderator",
    errorLoadingRoles: "Error loading roles",
    // Staff/Admin
    staffMembers: "Staff Members",
    searchOrAddUser: "Search or add a user",
    allRoles: "All roles",
    searchAdd: "Search / Add",
    user: "User",
    role: "Role",
    lastLogin: "Last login",
    actions: "Actions",
    // Unauthorized Page
    accessDenied: "Access denied",
    accessDeniedDesc1: "You are logged in as ",
    accessDeniedDesc2: ", but you do not have the required permissions to access this page.",
    unauthorizedNextSteps1: "Check that you have the correct role",
    unauthorizedNextSteps2: "Contact a bot administrator",
    unauthorizedNextSteps3: "Request the required permissions",
    // Pending Page
    pendingApproval: "Pending approval",
    pendingApprovalDesc1: "Your Discord account (",
    pendingApprovalDesc2: ") is connected, but you do not have access to the dashboard yet.",
    nextSteps: "Next steps",
    pendingNextSteps1: "An administrator must approve your access",
    pendingNextSteps2: "You will receive access once your request is accepted",
    pendingNextSteps3: "This page will refresh automatically",

    // Member Details & General
    riskScoreLabel: "Risk score",
    messagesLabel: "Messages",
    mutesLabel: "Mutes",
    kicksLabel: "Kicks",
    bansLabel: "Bans",
    statusLabel: "Status",
    mutedLabel: "Muted",
    pastMutesLabel: "past mute(s)",
    bannedLabel: "Banned",
    trustedLabel: "Trusted",
    rolesLabel: "Roles",
    viewMore: "View →",
    viewAllHistory: "View all history",
    backLabel: "Back",
    muteHistoryLabel: "Mute history",
    noMuteLabel: "No mutes",
    durationLabel: "Duration",
    reasonLabel: "Reason",
    endLabel: "End",
    inLabel: "in",
    expiredLabel: "expired",
    kickHistoryLabel: "Kick history",
    noKickLabel: "No kicks",
    byLabel: "By",
    banHistoryLabel: "Ban history",
    noBanLabel: "No bans",
    roleAtBanLabel: "Role at ban time",
    warningsSanctionsLabel: "Warnings & Sanctions",
    noWarningLabel: "No warnings",
    sanctionLabel: "Sanction",
    recentMessagesLabel: "Recent messages",
    loadingMessagesLabel: "Loading messages...",
    noMessagesLabel: "No messages found",
    emptyMsgMediaLabel: "[Empty message or media]",
    completeHistoryLabel: "Complete history",
    riskScoreDetailsLabel: "Risk score details",
    totalScoreLabel: "Total score",
    ptsLabel: "pts",
    scoreFormulaLabel: "The score is calculated from:",
    accountAgeLabel: "Account age",
    messagesCountLabel: "Message count",
    suspiciousLinksLabel: "Suspicious links shared",
    warningsCountLabel: "Warnings received",
    recentBehaviorLabel: "Recent behavior",
    memberRolesLabel: "Member roles",
    loadingLabel: "Loading...",
    currentRolesLabel: "Current roles",
    addLabel: "Add",
    noRolesLabel: "No roles",
    removeLabel: "Remove",
    searchSelectRolePlaceholder: "Search or select a role...",
    noRolesAvailableLabel: "No roles available",
    cancelLabel: "Cancel",
    confirmLabel: "Confirm",
    removeRoleConfirmPrompt: "Remove role",
    fromLabel: "from",

    // Action Labels / Logs Tab
    actionBan: "Banned",
    actionKick: "Kicked",
    actionMute: "Muted",
    actionUnmute: "Mute removed",
    actionUnban: "Unbanned",
    actionTrustAdd: "Marked trusted",
    actionTrustRemove: "Trusted removed",
    actionLockdownOn: "Lockdown activated",
    actionLockdownOff: "Lockdown deactivated",
    actionQuarantine: "Quarantined",
    actionConfigChange: "Config modified",
    actionRoleRemove: "Role removed",

    filterBans: "Bans",
    filterKicks: "Kicks",
    filterMutes: "Mutes",
    filterUnmutes: "Unmutes",
    filterUnbans: "Unbans",
    filterQuarantine: "Quarantine",
    filterTrust: "Trusted",
    filterConfig: "Config",

    periodAll: "All",
    periodToday: "Today",
    periodWeek: "7 days",
    periodMonth: "30 days",
    resetLabel: "Reset",
    resultLabel: "result",
    resultsLabel: "results",
    noResultsFilters: "No results for these filters",
    moderatorLabel: "Moderator",
    targetLabel: "Target",
    dateLabel: "Date",
    detailsLabel: "Details",
    noActionsRecorded: "No actions recorded",
    searchLogsPlaceholder: "Search in logs... (reason, user, @member)",
    bannedHistoryLabel: "Ban history",
    entryLabel: "entry",
    entriesLabel: "entries",
    searchHistoryPlaceholder: "Search by username or reason...",
    allLabel: "All",
    unbannedLabel: "Unbanned",
    allPeriodLabel: "All period",
    noBanHistoryLabel: "No ban history",
    bannedOnLabel: "Banned on",
    unbannedOnLabel: "Unbanned on",
    bannedOnlyBtn: "Banned",
    historyBtn: "History",
    searchBannedPlaceholder: "Search in banned...",
    searchMemberPlaceholder: "Search a member (or @)...",
    roleAddPlaceholder: "@Add",
    noRolesFoundLabel: "No roles found",
    memberLabel: "Member",
    membersLabel: "members",
    riskLabel: "Risk",
    msgsLabel: "Msgs",
    warnsLabel: "Mutes",
    actionsLabel: "Actions",
    noMembersLabel: "No members.",
    
    // Overview tab
    securityEventsLabel: "Security events",
    phishingLinksLabel: "Phishing links",
    detectedSecretsLabel: "Detected secrets",
    lockdownLabel: "Lockdown",
    activeLabel: "ACTIVE",
    inactiveLabel: "Inactive",
    disableLabel: "Disable",
    enableLabel: "Enable",
    
    // Incidents tab
    noIncidentsLabel: "No incidents.",
    titleLabel: "Title",
    channelLabel: "Channel",
    severityLabel: "Severity",
    
    // Event modal / typeLabels
    eventRaidDetected: "Raid detected",
    eventSpamDetected: "Spam detected",
    eventPhishingLink: "Phishing link",
    eventSecretLeaked: "Secret leaked",
    eventPermissionChange: "Permission change",
    eventRoleEscalation: "Role escalation",
    eventMassBan: "Mass ban",
    eventMassKick: "Mass kick",
    eventChannelDelete: "Channel deleted",
    eventWebhookCreated: "Webhook created",
    eventCanaryTriggered: "Canary triggered",
    eventEmergencyActivated: "Emergency activated",
    eventQuarantineApplied: "Quarantine applied",
    eventModeratorAnomaly: "Moderator anomaly",
    eventSuspiciousJoin: "Suspicious join",
    eventInviteSuspicious: "Suspicious invite",
    
    eventModalMember: "Member",
    eventModalChannel: "Channel",
    eventModalDate: "Date",
    eventModalDetails: "DETAILS",
    eventModalMessages: "Detected messages",
    loadingEvents: "Loading events...",
    noSecurityEvents: "No security events.",
    messagesDetected: "detected message(s)",
    
    // Incident Modal
    incidentStatusNew: "New",
    incidentStatusInProgress: "In progress",
    incidentStatusContained: "Contained",
    incidentStatusResolved: "Resolved",
    incidentStatusFalsePositive: "False positive",
    incidentEventsLabel: "Events",
    incidentActionsLabel: "Actions",
    incidentCreatedLabel: "Created on",
    incidentDescriptionLabel: "DESCRIPTION",
    incidentLatestEventsLabel: "LATEST EVENTS",
    
    // Member actions modals
    muteUserTitle: "Mute",
    durationMinutesLabel: "Duration (minutes)",
    minuteLabel: "minute",
    minutesLabel: "minutes",
    hourLabel: "hour",
    hoursLabel: "hours",
    dayLabel: "day",
    daysLabel: "days",
    sendDmLabel: "Send private message",
    confirmMuteBtn: "Confirm mute",
    banUserTitle: "Ban",
    banReasonPlaceholder: "Ban reason...",
    confirmBanBtn: "Confirm ban",
    kickUserTitle: "Kick",
    kickReasonPlaceholder: "Kick reason...",
    confirmKickBtn: "Confirm kick",
  }
};

type TranslationKeys = keyof typeof translations.fr;

type TranslationDictionary = Record<Language, Map<string, string>>;

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

const uiFallbackTranslations: Array<[string, string]> = [
  ["expiré", "expired"],
  ["Mute retiré", "Mute removed"],
  ["Banni", "Banned"],
  ["Exclu", "Kicked"],
  ["Fiable ajouté", "Trusted added"],
  ["Fiable retiré", "Trusted removed"],
  ["Rôle retiré", "Role removed"],
  ["Durée:", "Duration:"],
  ["Raison:", "Reason:"],
  ["Fin:", "End:"],
  ["Par:", "By:"],
  ["Sanction:", "Sanction:"],
  ["Messages", "Messages"],
  ["Mutes", "Mutes"],
  ["Kicks", "Kicks"],
  ["Bans", "Bans"],
  ["Statut", "Status"],
  ["Rôles", "Roles"],
  ["Voir →", "View →"],
  ["Retour", "Back"],
  ["minute(s)", "minute(s)"],
  ["ID:", "ID:"],
];

function buildTranslationDictionary(): TranslationDictionary {
  const dictionary: TranslationDictionary = { fr: new Map(), en: new Map() };
  const addPair = (frValue: string, enValue: string) => {
    const fr = normalizeText(frValue);
    const en = normalizeText(enValue);
    if (!fr || !en) return;
    dictionary.en.set(fr, en);
    dictionary.fr.set(en, fr);
  };

  for (const key of Object.keys(translations.fr) as TranslationKeys[]) {
    addPair(translations.fr[key], translations.en[key]);
  }
  for (const [fr, en] of uiFallbackTranslations) addPair(fr, en);

  return dictionary;
}

function translateExactText(value: string, targetLanguage: Language, dictionary: TranslationDictionary) {
  const normalized = normalizeText(value);
  if (!normalized) return value;

  const translated = dictionary[targetLanguage].get(normalized);
  if (!translated) return value;

  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  return `${leading}${translated}${trailing}`;
}

function translateDom(root: ParentNode, targetLanguage: Language, dictionary: TranslationDictionary) {
  if (typeof document === "undefined") return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-no-i18n]")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const node of textNodes) {
    const translated = translateExactText(node.nodeValue || "", targetLanguage, dictionary);
    if (translated !== node.nodeValue) node.nodeValue = translated;
  }

  const attributeNames = ["placeholder", "title", "aria-label"];
  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll<HTMLElement>("[placeholder], [title], [aria-label]"))] : Array.from(root.querySelectorAll<HTMLElement>("[placeholder], [title], [aria-label]"));
  for (const element of elements) {
    if (element.closest("[data-no-i18n]")) continue;
    for (const attribute of attributeNames) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const translated = translateExactText(current, targetLanguage, dictionary);
      if (translated !== current) element.setAttribute(attribute, translated);
    }
  }
}


type I18nContextType = {
  language: Language;
  t: (key: TranslationKeys) => string;
  setLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
};

const I18nContext = createContext<I18nContextType>({
  language: "fr",
  t: (key) => translations.fr[key] || (key as string),
  setLanguage: async () => {},
  isLoading: false
});

export function useI18n() {
  return useContext(I18nContext);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [language, setLanguageState] = useState<Language>("fr");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load from localStorage as initial fallback
  useEffect(() => {
    const saved = localStorage.getItem("language") as Language;
    if (saved === "fr" || saved === "en") {
      setLanguageState(saved);
    }
  }, []);

  // Fetch language preference from database on login
  useEffect(() => {
    if (status === "authenticated" && session) {
      const apiToken = (session as any).apiToken;
      if (apiToken) {
        setAuthToken(apiToken);
        setIsLoading(true);
        apiFetch<{ language: string }>("/api/auth/language")
          .then((res) => {
            if (res.language === "fr" || res.language === "en") {
              setLanguageState(res.language);
              localStorage.setItem("language", res.language);
            }
          })
          .catch((err) => {
            console.error("Failed to load user language preference:", err);
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
    }
  }, [status, session]);

  const setLanguage = async (newLang: Language) => {
    setLanguageState(newLang);
    localStorage.setItem("language", newLang);

    if (status === "authenticated" && session) {
      const apiToken = (session as any).apiToken;
      if (apiToken) {
        setAuthToken(apiToken);
        try {
          await apiFetch("/api/auth/language", {
            method: "PUT",
            body: { language: newLang }
          });
        } catch (err) {
          console.error("Failed to save language preference:", err);
        }
      }
    }
  };

  const dictionary = useMemo(() => buildTranslationDictionary(), []);

  const t = useCallback((key: TranslationKeys) => {
    return translations[language][key] || translations.fr[key] || (key as string);
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language;

    const runTranslation = () => translateDom(document.body, language, dictionary);
    runTranslation();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          const node = mutation.target as Text;
          const translated = translateExactText(node.nodeValue || "", language, dictionary);
          if (translated !== node.nodeValue) node.nodeValue = translated;
          continue;
        }

        for (const addedNode of Array.from(mutation.addedNodes)) {
          if (addedNode.nodeType === Node.TEXT_NODE) {
            const textNode = addedNode as Text;
            const translated = translateExactText(textNode.nodeValue || "", language, dictionary);
            if (translated !== textNode.nodeValue) textNode.nodeValue = translated;
          } else if (addedNode.nodeType === Node.ELEMENT_NODE) {
            translateDom(addedNode as Element, language, dictionary);
          }
        }

        if (mutation.type === "attributes" && mutation.target.nodeType === Node.ELEMENT_NODE) {
          translateDom(mutation.target as Element, language, dictionary);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label"],
    });

    return () => observer.disconnect();
  }, [language, dictionary]);

  return (
    <I18nContext.Provider value={{ language, t, setLanguage, isLoading }}>
      {children}
    </I18nContext.Provider>
  );
}
