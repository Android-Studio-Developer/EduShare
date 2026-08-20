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
  | "partner";

export interface ChatMessage {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorRank?: Rank;
  authorPhotoUrl?: string;
  isBot?: boolean;
  createdAt: number;
  pinned?: boolean;
  reactions?: Record<string, string[]>;
  fileId?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  replyToId?: string;
  replyToAuthor?: string;
  replyToText?: string;
  poll?: { question: string; options: string[]; votes: Record<string, string[]> };
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

export type ActivityType = "server_created" | "code_unlocked" | "chat_message";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  serverId: string;
  serverName: string;
  actorName: string;
  createdAt: number;
}

export type SiteRole = "owner" | "moderator" | "member";

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
  type: "moderation" | "report" | "system" | "mention" | "dm" | "donation";
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  usernameLower: string;
  photoUrl: string;
  bannerUrl: string;
  bannerEffect: string;
  bio: string;
  favoriteGames: string;
  joinedAt: number;
  lastDailyClaim: number;
  rank: Rank;
  playMinutes: number;
  banned: boolean;
  lastActiveAt: number;
  botXp: number;
  lastGameAt: number;
  lastActivityReward: number;
  partyId: string;
  guildId: string;
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
  ownerId: string;
  ownerName: string;
  coOwnerId: string;
  memberIds: string[];
  nameColor: string;
  nameEffect: GroupNameEffect;
  nameGlow: boolean;
  createdAt: number;
}

export type FriendRequestStatus = "pending" | "accepted" | "declined";

export interface VoiceChannelDoc {
  id: string;
  name: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  isDefault: boolean;
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
