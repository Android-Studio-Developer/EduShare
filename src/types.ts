export interface MinecraftServer {
  id: string;
  name: string;
  description: string;
  subject: string;
  edition: string;
  code: string[];
  imageUrl: string;
  imageUrls: string[];
  rules: string[];
  ownerId: string;
  ownerName: string;
  maxPlayers: number;
  hasShop: boolean;
  joinsCount: number;
  visitsCount: number;
  isOnline: boolean;
  isVerified: boolean;
  isPartner: boolean;
  partnerPerks: string;
  slowModeSeconds: number;
  bannedUserIds: string[];
  managerIds: string[];
  createdAt: number;
}

export interface PartnerRequest {
  id: string;
  userId: string;
  serverId: string;
  serverName: string;
  message: string;
  contact: string;
  status: "open" | "accepted" | "declined";
  createdAt: number;
}

export type NewServerInput = Omit<
  MinecraftServer,
  "id" | "ownerId" | "ownerName" | "joinsCount" | "visitsCount" | "isOnline" | "isVerified" | "isPartner" | "partnerPerks" | "slowModeSeconds" | "bannedUserIds" | "managerIds" | "createdAt"
>;

export type Rank =
  | "none"
  | "vip"
  | "vip_plus"
  | "vip_plus_plus"
  | "mvp_plus"
  | "mvp_plus_plus"
  | "mod"
  | "admin"
  | "owner"
  | "partner"
  | "advertiser"
  | "builder";

export interface ChatMessage {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorRank?: Rank;
  authorPhotoUrl?: string;
  isBot?: boolean;
  botId?: string;
  triggeredById?: string;
  deliveryState?: "sending" | "sent";
  createdAt: number;
  pinned?: boolean;
  reactions?: Record<string, string[]>;
  fileId?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  replyToId?: string;
  replyToAuthorId?: string;
  replyToAuthor?: string;
  replyToText?: string;
  replyPing?: boolean;
  poll?: { question: string; options: string[]; votes: Record<string, string[]> };
  youtubeId?: string;
}

export type DeveloperApplicationStatus = "pending" | "approved" | "rejected";

export interface DeveloperApplication {
  id: string;
  userId: string;
  applicantName: string;
  applicantEmail: string;
  experience: string;
  motivation: string;
  botIdea: string;
  safetyPlan: string;
  dataPlan: string;
  status: DeveloperApplicationStatus;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
}

export interface DeveloperBotCommand {
  name: string;
  response: string;
  action?: "reply" | "verify";
}

export interface DeveloperBot {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  handle: string;
  description: string;
  avatarUrl: string;
  enabled: boolean;
  verificationEnabled: boolean;
  prefix: string;
  commands: DeveloperBotCommand[];
  createdAt: number;
  updatedAt: number;
}

export interface DeveloperBotEvent {
  id: string;
  botId: string;
  command: string;
  invokedById: string;
  invokedByName: string;
  status: "success" | "unknown_command" | "rate_limited" | "failed";
  latencyMs: number;
  createdAt: number;
}

export interface LoginEvent {
  id: string;
  userId: string;
  method: "password" | "google" | "signup";
  device: string;
  browser?: string;
  os?: string;
  createdAt: number;
}

export interface OwnerLoginAudit extends LoginEvent {
  email: string;
  ipAddress: string;
}

export interface DeveloperAuditEvent {
  id: string;
  actorId: string;
  actorName: string;
  botOwnerId: string;
  botId: string;
  botName: string;
  action: "bot_created" | "bot_updated" | "bot_deleted" | "application_approved" | "application_rejected";
  createdAt: number;
}

export type CommunityServerRole = "owner" | "admin" | "mod" | "member";

export interface CommunityServerTextChannel {
  id: string;
  name: string;
}

export interface CommunityServerVoiceChannel {
  id: string;
  name: string;
}

export interface CommunityChatServer {
  id: string;
  name: string;
  description: string;
  rules: string[];
  ownerId: string;
  ownerName: string;
  iconUrl: string;
  bannerUrl: string;
  linkedMinecraftServerId: string;
  inviteCode: string;
  memberIds: string[];
  bannedUserIds: string[];
  bannedUsernames: string[];
  roles: Record<string, CommunityServerRole>;
  textChannels: CommunityServerTextChannel[];
  voiceChannels: CommunityServerVoiceChannel[];
  boostCount: number;
  lastBoostedAt: number;
  createdAt: number;
  isPublic?: boolean;
  uploadCount?: number;
}

export interface DmMessage {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  pinned?: boolean;
  isBot?: boolean;
  reactions?: Record<string, string[]>;
  replyToId?: string;
  replyToAuthor?: string;
  replyToText?: string;
  fileId?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
}

export interface DmConversation {
  id: string;
  participants: string[];
  createdAt: number;
  lastMessageAt: number;
  lastMessageText: string;
  lastMessageAuthorId: string;
  isGroup?: boolean;
  name?: string;
  ownerId?: string;
  iconUrl?: string;
  callStartedAt?: number;
  callStartedBy?: string;
}

export type ActivityType = "server_created" | "code_unlocked" | "chat_message";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  serverId: string;
  serverName: string;
  actorName: string;
  createdAt: number;
}

export type SiteRole = "owner" | "moderator" | "headmod" | "actor" | "dabug" | "member";

export interface ModeratorApplication {
  id: string;
  userId: string;
  applicantName: string;
  applicantEmail: string;
  experience: string;
  motivation: string;
  conflictResponse: string;
  duplicateMapResponse: string;
  availability: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  reviewedAt?: number;
}

export interface AccountRecoveryRequest {
  id: string;
  input: string;
  contact: string;
  status: "open" | "resolved";
  createdAt: number;
}

export interface ShopItem {
  id: string;
  name: string;
  minecraftItemId: string;
  price: number;
  description: string;
  enabled: boolean;
  imageId?: string;
  imageUrl?: string;
}

export interface ShopOrder {
  id: string;
  buyerId: string;
  buyerName: string;
  minecraftName: string;
  itemId: string;
  itemName: string;
  minecraftItemId: string;
  price: number;
  status: "pending" | "fulfilled";
  createdAt: number;
}

export interface ShopNotification {
  id: string;
  recipientId: string;
  serverId: string;
  serverName: string;
  buyerName: string;
  itemName: string;
  read: boolean;
  createdAt: number;
}

export type ReportReason = "duplicate_map" | "inappropriate_content" | "shop_scam" | "harassment" | "other";

export interface ServerReport {
  id: string;
  serverId: string;
  serverName: string;
  serverOwnerId: string;
  reporterId: string;
  reporterName: string;
  reason: ReportReason;
  details: string;
  originalServerId: string;
  evidenceUrl: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  createdAt: number;
}

export interface DisputeMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
}

export interface SiteNotification {
  id: string;
  recipientId: string;
  type: "moderation" | "report" | "system" | "mention" | "dm" | "donation" | "game" | "event";
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: number;
}

export interface CommunityEventParticipant {
  id: string;
  name: string;
  photoUrl: string;
}

export interface CommunityEvent {
  id: string;
  hostId: string;
  hostName: string;
  hostPhotoUrl: string;
  title: string;
  description: string;
  link: string;
  creditPrize: number;
  participantIds: string[];
  participants: CommunityEventParticipant[];
  status: "active" | "finished" | "cancelled";
  winnerId: string;
  winnerName: string;
  payoutClaimed: boolean;
  createdAt: number;
  endsAt: number;
  finishedAt: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  usernameLower: string;
  photoUrl: string;
  bannerUrl: string;
  backgroundUrl: string;
  bannerEffect: string;
  bio: string;
  favoriteGames: string;
  joinedAt: number;
  lastDailyClaim: number;
  rank: Rank;
  playMinutes: number;
  banned: boolean;
  lastActiveAt: number;
  presenceStatus: PresenceStatus;
  customStatus: string;
  activityGame: string;
  activityStartedAt: number;
  customEmojis: CustomEmoji[];
  botXp: number;
  lastGameAt: number;
  lastActivityReward: number;
  partyId: string;
  guildId: string;
  cosmeticPackOwned: boolean;
  bedwarsRating: number;
  bedwarsWins: number;
  bedwarsLosses: number;
  ownedCosmetics: string[];
  nameFont: string;
  nameEffect: string;
  nameplateEffect: string;
  nameColor: string;
  pfpEffect: string;
  profileEffect: string;
  referredBy: string;
  referralRewardPending: number;
  buildHelpPending: number;
  buildHelpCredits: number;
  // Invisible — no UI shows this exists unless you're the owner. Gates access
  // to the voice changer. Only the owner account can grant it, not mods.
  voiceUnlocked: boolean;
  verifiedBotIds: string[];
  lastVerifiedBotId: string;
}

export interface CustomEmoji {
  id: string;
  name: string;
  url: string;
  fileId: string;
}

export type PresenceStatus = "online" | "idle" | "dnd" | "invisible";

export interface AdvertiserRequest {
  id: string;
  userId: string;
  userName: string;
  message: string;
  status: "open" | "accepted" | "declined";
  createdAt: number;
}

export type GroupNameEffect = "none" | "chroma";

export interface Party {
  id: string;
  name: string;
  leaderId: string;
  leaderName: string;
  coLeaderId: string;
  memberIds: string[];
  createdAt: number;
  expiresAt: number;
}

export interface Guild {
  id: string;
  name: string;
  tag?: string;
  tagIcon?: GuildTagIcon;
  tagFont?: GuildTagFont;
  tagImageUrl?: string;
  tagColor?: string;
  ownerId: string;
  ownerName: string;
  coOwnerId: string;
  memberIds: string[];
  nameColor: string;
  nameEffect: GroupNameEffect;
  nameGlow: boolean;
  createdAt: number;
}

export type GuildTagIcon = "leaf" | "swords" | "heart" | "flame" | "droplet" | "skull" | "moon" | "zap" | "sparkles" | "mushroom";
export type GuildTagFont = "mono" | "poppins" | "playfair" | "comic" | "handwritten" | "bungee" | "pixel";

export type FriendRequestStatus = "pending" | "accepted" | "declined";

export interface VoiceChannelDoc {
  id: string;
  name: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  isDefault: boolean;
  staffOnly?: boolean;
  lastActivityAt?: number;
  bedwarsLobbyId?: string;
  bedwarsTeam?: BedwarsTeam;
}

export interface VoiceParticipant {
  id: string;
  displayName: string;
  photoUrl: string;
  rank: Rank;
  muted: boolean;
  joinedAt: number;
  lastSeenAt: number;
}

export interface VoiceChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string;
  text: string;
  broadcastTts?: boolean;
  createdAt: number;
}

export interface MovieSignup {
  id: string;
  displayName: string;
  photoUrl: string;
  note: string;
  createdAt: number;
}

export type VoiceSignalType = "offer" | "answer" | "candidate";

export interface VoiceSignal {
  id: string;
  fromUid: string;
  toUid: string;
  type: VoiceSignalType;
  payload: string;
  createdAt: number;
}

export type DuelStatus = "pending" | "resolved" | "declined";

export interface Duel {
  id: string;
  challengerId: string;
  challengerName: string;
  opponentId: string;
  opponentName: string;
  status: DuelStatus;
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  game: string;
  bet: number;
  createdAt: number;
  resolvedAt: number;
  challengerHandled: boolean;
  opponentHandled: boolean;
}

export type WordleDuelStatus = "waiting" | "active" | "finished" | "cancelled";

export interface WordleDuelGuess {
  word: string;
  pattern: string;
  createdAt: number;
}

export interface WordleDuel {
  id: string;
  hostId: string;
  hostName: string;
  hostPhotoUrl: string;
  guestId: string;
  guestName: string;
  guestPhotoUrl: string;
  invitedId: string;
  invitedName: string;
  answer: string;
  bet: number;
  hostGuesses: WordleDuelGuess[];
  guestGuesses: WordleDuelGuess[];
  status: WordleDuelStatus;
  winnerId: string;
  winnerName: string;
  createdAt: number;
  startedAt: number;
  finishedAt: number;
  hostPayoutClaimed: boolean;
  guestPayoutClaimed: boolean;
}

export type ChessDuelStatus = "waiting" | "active" | "finished" | "cancelled";
export type ChessColor = "w" | "b";
export type ChessResult = "" | "white" | "black" | "draw";
export type ChessTimeControl = "blitz_5_3" | "rapid_10";

export interface ChessDuelMove {
  from: string;
  to: string;
  promotion: "q" | "r" | "b" | "n";
  san: string;
  byId: string;
  createdAt: number;
}

export interface ChessDuel {
  id: string;
  whiteId: string;
  whiteName: string;
  whitePhotoUrl: string;
  blackId: string;
  blackName: string;
  blackPhotoUrl: string;
  invitedId: string;
  invitedName: string;
  fen: string;
  moves: ChessDuelMove[];
  turn: ChessColor;
  check: boolean;
  status: ChessDuelStatus;
  result: ChessResult;
  winnerId: string;
  winnerName: string;
  endReason: string;
  creditBet: number;
  timeControl?: ChessTimeControl;
  initialTimeMs?: number;
  incrementMs?: number;
  whiteTimeMs?: number;
  blackTimeMs?: number;
  turnStartedAt?: number;
  whitePayoutClaimed: boolean;
  blackPayoutClaimed: boolean;
  createdAt: number;
  startedAt: number;
  finishedAt: number;
}

export interface ChessRoomMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string;
  text: string;
  createdAt: number;
}

export interface WordleSpectator {
  id: string;
  displayName: string;
  photoUrl: string;
  lastSeenAt: number;
}

export type PropertyGameStatus = "waiting" | "active" | "finished" | "cancelled";
export type PropertyGamePhase = "roll" | "buy" | "end";

export interface PropertyGamePlayer {
  id: string;
  name: string;
  photoUrl: string;
  token: string;
  position: number;
  cash: number;
  properties: string[];
  inDetention: boolean;
  detentionTurns: number;
  bankrupt: boolean;
}

export interface PropertyGameLogEntry {
  id: string;
  text: string;
  createdAt: number;
}

export interface PropertyGameRoom {
  id: string;
  hostId: string;
  hostName: string;
  maxPlayers: number;
  startingCash: number;
  playerIds: string[];
  players: PropertyGamePlayer[];
  status: PropertyGameStatus;
  currentPlayerIndex: number;
  phase: PropertyGamePhase;
  pendingPropertyId: string;
  lastDice: number[];
  lastCardTitle: string;
  lastCardText: string;
  winnerId: string;
  winnerName: string;
  deckIndex: number;
  turnNumber: number;
  log: PropertyGameLogEntry[];
  createdAt: number;
  startedAt: number;
  finishedAt: number;
}

export interface FriendRequest {
  id: string;
  fromId: string;
  fromName: string;
  fromPhotoUrl: string;
  toId: string;
  toName: string;
  toPhotoUrl: string;
  status: FriendRequestStatus;
  createdAt: number;
}

export interface ServerReview {
  id: string;
  authorId: string;
  authorName: string;
  fun: number;
  moderation: number;
  educational: number;
  shopTrust: number;
  text: string;
  createdAt: number;
}

export interface FlaggedMessage {
  id: string;
  source: "chat" | "publicChat";
  serverId: string;
  serverName: string;
  text: string;
  authorId: string;
  authorName: string;
  deletedById: string;
  deletedByName: string;
  createdAt: number;
}

export interface ServerAnnouncement {
  id: string;
  text: string;
  createdAt: number;
}

export type ShareType = "world" | "mod" | "addon";

export type MemeVisibility = "public" | "private";

export interface MemePost {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string;
  imageUrl: string;
  caption: string;
  visibility: MemeVisibility;
  recipientId: string;
  recipientName: string;
  createdAt: number;
}

export interface SharedFile {
  id: string;
  name: string;
  description: string;
  type: ShareType;
  downloadUrl: string;
  imageUrl: string;
  authorId: string;
  authorName: string;
  downloadCount: number;
  price: number;
  createdAt: number;
}

export type BedwarsTeam = "a" | "b";
export type BedwarsMode = "bedfight" | "1v1" | "3v3" | "4v4";

export interface BedwarsQueueEntry {
  uid: string;
  displayName: string;
  elo: number;
  partyId: string;
  lobbyCode: string;
  mode: BedwarsMode;
  queuedAt: number;
}

export interface BedwarsLobbyPlayer {
  uid: string;
  name: string;
  elo: number;
  team: BedwarsTeam;
}

export type BedwarsLobbyStatus =
  | "voting"
  | "role_select"
  | "in_progress"
  | "awaiting_review"
  | "scored"
  | "rejected"
  | "cancelled";

export interface BedwarsLobby {
  id: string;
  playerIds: string[];
  players: BedwarsLobbyPlayer[];
  mode: BedwarsMode;
  status: BedwarsLobbyStatus;
  mapOptions: string[];
  mapVotes: Record<string, string>;
  chosenMap: string;
  roles: Record<string, string>;
  voiceChannelAId: string;
  voiceChannelBId: string;
  screenshotUrl: string;
  winningTeamClaim: BedwarsTeam | "";
  topKillerId: string;
  submittedBy: string;
  reviewedBy: string;
  reviewedAt: number;
  createdAt: number;
}

export const SUBJECTS = [
  "SMP",
  "Bedwars",
  "PvP",
  "Skyblock",
  "Creative Build",
  "Survival",
  "Minigames",
  "Redstone & Coding",
] as const;
