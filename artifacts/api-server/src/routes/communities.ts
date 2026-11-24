import { Router, type Request, type Response } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  communitiesTable,
  communityChannelsTable,
  communityMembersTable,
  communityMessagesTable,
  communityRolesTable,
  usersTable,
  voiceRoomParticipantsTable,
  voiceRoomsTable,
  type CommunityPermissions,
} from "@workspace/db";
import { db } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();
const communityCoverDir = path.join(process.cwd(), "uploads", "community-covers");
fs.mkdirSync(communityCoverDir, { recursive: true });
const communityCoverUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, communityCoverDir),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, file.mimetype.startsWith("image/") && allowed.has(extension));
  },
});
const ALL_PERMISSIONS: CommunityPermissions = {
  manageCommunity: true,
  manageMembers: true,
  manageRoles: true,
  manageChannels: true,
  manageMessages: true,
  sendMessages: true,
  connectVoice: true,
  inviteMembers: true,
};
const MEMBER_PERMISSIONS: CommunityPermissions = {
  sendMessages: true,
  connectVoice: true,
  inviteMembers: true,
};
const PERMISSION_KEYS = Object.keys(ALL_PERMISSIONS) as (keyof CommunityPermissions)[];

export const communitySchemaReady = (async () => {
  await db.execute(sql`ALTER TABLE voice_rooms ADD COLUMN IF NOT EXISTS is_persistent boolean NOT NULL DEFAULT false`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS communities (
      id serial PRIMARY KEY,
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      emoji text NOT NULL DEFAULT '🌙',
      access_mode text NOT NULL DEFAULT 'public',
      invite_code text NOT NULL UNIQUE,
      created_by integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`ALTER TABLE communities ADD COLUMN IF NOT EXISTS cover_image_url text`);
  await db.execute(sql`ALTER TABLE communities ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#8b5cf6'`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS community_roles (
      id serial PRIMARY KEY,
      community_id integer NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      name text NOT NULL,
      color text NOT NULL DEFAULT '#8b5cf6',
      permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
      position integer NOT NULL DEFAULT 0,
      is_default boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS community_members (
      id serial PRIMARY KEY,
      community_id integer NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id integer REFERENCES community_roles(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'active',
      joined_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (community_id, user_id)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS community_channels (
      id serial PRIMARY KEY,
      community_id integer NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      name text NOT NULL,
      type text NOT NULL DEFAULT 'text',
      position integer NOT NULL DEFAULT 0,
      voice_room_id integer REFERENCES voice_rooms(id) ON DELETE SET NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS community_messages (
      id serial PRIMARY KEY,
      channel_id integer NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
      sender_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS community_members_status_idx ON community_members (community_id, status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS community_messages_channel_idx ON community_messages (channel_id, id DESC)`);
})().catch((error) => {
  console.error("Community schema migration failed:", error);
  throw error;
});
const schemaReady = communitySchemaReady;

type CommunityContext = {
  community: typeof communitiesTable.$inferSelect;
  role: typeof communityRolesTable.$inferSelect | null;
  status: string;
};

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizeName(value: unknown, min: number, max: number) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= min && name.length <= max ? name : null;
}

function normalizePermissions(value: unknown): CommunityPermissions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const permissions: CommunityPermissions = {};
  for (const key of PERMISSION_KEYS) {
    const permission = input[key];
    if (permission !== undefined && typeof permission !== "boolean") return null;
    if (typeof permission === "boolean") permissions[key] = permission;
  }
  return permissions;
}

async function getContext(communityId: number, userId: number): Promise<CommunityContext | null> {
  const communities = await db.select().from(communitiesTable).where(eq(communitiesTable.id, communityId)).limit(1);
  const community = communities[0];
  if (!community) return null;
  const memberships = await db
    .select({ status: communityMembersTable.status, role: communityRolesTable })
    .from(communityMembersTable)
    .leftJoin(communityRolesTable, eq(communityMembersTable.roleId, communityRolesTable.id))
    .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, userId)))
    .limit(1);
  return memberships[0]
    ? { community, role: memberships[0].role, status: memberships[0].status }
    : { community, role: null, status: "none" };
}

function hasPermission(context: CommunityContext, userId: number, permission: keyof CommunityPermissions) {
  return context.community.createdBy === userId || context.role?.permissions?.[permission] === true;
}

async function requirePermission(
  req: Request,
  res: Response,
  communityId: number,
  permission: keyof CommunityPermissions,
) {
  const context = await getContext(communityId, req.user!.id);
  if (!context) {
    res.status(404).json({ error: "Topluluk bulunamadı." });
    return null;
  }
  if (context.status !== "active") {
    res.status(403).json({ error: "Bu topluluğun aktif üyesi değilsin." });
    return null;
  }
  if (!hasPermission(context, req.user!.id, permission)) {
    res.status(403).json({ error: "Bu işlem için yetkin yok." });
    return null;
  }
  return context;
}

async function createVoiceRoom(name: string, communityId: number, creatorId: number) {
  const roomCode = `#${randomBytes(3).toString("hex").toUpperCase()}`;
  const rooms = await db
    .insert(voiceRoomsTable)
    .values({
      name,
      description: `Topluluk ${communityId} ses kanalı`,
      roomCode,
      createdBy: creatorId,
      isActive: "true",
      isPersistent: true,
    })
    .returning();
  return rooms[0];
}

async function insertChannel(communityId: number, creatorId: number, name: string, type: "text" | "voice", position: number) {
  if (type === "voice") {
    const room = await createVoiceRoom(name, communityId, creatorId);
    const channels = await db.insert(communityChannelsTable).values({
      communityId,
      name,
      type,
      position,
      voiceRoomId: room.id,
    }).returning();
    return channels[0];
  }
  const channels = await db.insert(communityChannelsTable).values({ communityId, name, type, position }).returning();
  return channels[0];
}

async function addMember(communityId: number, userId: number, roleId: number, status = "active") {
  await db.insert(communityMembersTable)
    .values({ communityId, userId, roleId, status })
    .onConflictDoUpdate({
      target: [communityMembersTable.communityId, communityMembersTable.userId],
      set: { roleId, status, joinedAt: new Date() },
    });
}

async function communitySummary(community: typeof communitiesTable.$inferSelect, userId?: number) {
  const [members, membership, channels] = await Promise.all([
    db.select({ id: communityMembersTable.id })
      .from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, community.id), eq(communityMembersTable.status, "active"))),
    userId
      ? db.select({ status: communityMembersTable.status, role: communityRolesTable })
        .from(communityMembersTable)
        .leftJoin(communityRolesTable, eq(communityMembersTable.roleId, communityRolesTable.id))
        .where(and(eq(communityMembersTable.communityId, community.id), eq(communityMembersTable.userId, userId)))
        .limit(1)
      : Promise.resolve([]),
    db.select().from(communityChannelsTable)
      .where(eq(communityChannelsTable.communityId, community.id))
      .orderBy(communityChannelsTable.position),
  ]);
  const role = membership[0]?.role ?? null;
  const { inviteCode: _inviteCode, ...safeCommunity } = community;
  return {
    ...safeCommunity,
    memberCount: members.length,
    membershipStatus: membership[0]?.status ?? "none",
    role,
    permissions: membership[0]?.status === "active"
      ? (community.createdBy === userId ? ALL_PERMISSIONS : role?.permissions ?? {})
      : {},
    channels,
  };
}

router.get("/communities", async (req, res) => {
  try {
    await schemaReady;
    const communities = await db.select().from(communitiesTable).orderBy(desc(communitiesTable.createdAt)).limit(100);
    const visible = await Promise.all(communities.map(async (community) => {
      const summary = await communitySummary(community, req.user?.id);
      if (community.accessMode !== "public" && summary.membershipStatus === "none") return null;
      return summary.membershipStatus === "pending" ? { ...summary, channels: [] } : summary;
    }));
    res.json(visible.filter(Boolean));
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Topluluklar yüklenemedi." });
  }
});

router.get("/communities/owner/:userId", async (req, res) => {
  try {
    await schemaReady;
    const ownerId = parseId(req.params.userId);
    if (!ownerId) {
      res.status(400).json({ error: "Geçersiz kullanıcı." });
      return;
    }

    const ownedCommunities = await db.select().from(communitiesTable)
      .where(eq(communitiesTable.createdBy, ownerId))
      .orderBy(desc(communitiesTable.createdAt));
    const visibleCommunities = ownedCommunities.filter(community =>
      community.accessMode === "public"
      || community.accessMode === "approval"
      || req.user?.id === ownerId,
    );
    const summaries = await Promise.all(visibleCommunities.map(async community => {
      const summary = await communitySummary(community, req.user?.id);
      return summary.membershipStatus === "active"
        ? summary
        : { ...summary, channels: [] };
    }));
    res.json(summaries);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Kullanıcının toplulukları yüklenemedi." });
  }
});

router.post("/communities", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const name = normalizeName(req.body?.name, 2, 32);
    const description = typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 240) : "";
    const emoji = typeof req.body?.emoji === "string" && [...req.body.emoji].length <= 4 ? req.body.emoji : "🌙";
    const accessMode = req.body?.accessMode === "approval" ? "approval" : req.body?.accessMode === "public" ? "public" : null;
    if (!name || !accessMode) {
      res.status(400).json({ error: "Topluluk adı ve katılım türü geçerli olmalı." });
      return;
    }
    const created = await db.transaction(async (tx) => {
      const communities = await tx.insert(communitiesTable).values({
        name,
        description,
        emoji,
        accessMode,
        inviteCode: randomUUID(),
        createdBy: req.user!.id,
      }).returning();
      const community = communities[0];
      const roles = await tx.insert(communityRolesTable).values([
        { communityId: community.id, name: "Yönetici", color: "#efb94b", permissions: ALL_PERMISSIONS, position: 100, isDefault: false },
        { communityId: community.id, name: "Üye", color: "#8b5cf6", permissions: MEMBER_PERMISSIONS, position: 0, isDefault: true },
      ]).returning();
      const managerRole = roles.find((role) => role.name === "Yönetici")!;
      await tx.insert(communityMembersTable).values({ communityId: community.id, userId: req.user!.id, roleId: managerRole.id, status: "active" });
      await tx.insert(communityChannelsTable).values({ communityId: community.id, name: "genel", type: "text", position: 0 });
      const roomCode = `#${randomBytes(3).toString("hex").toUpperCase()}`;
      const rooms = await tx.insert(voiceRoomsTable).values({
        name: "Sohbet odası",
        description: `Topluluk ${community.id} ses kanalı`,
        roomCode,
        createdBy: req.user!.id,
        isActive: "true",
        isPersistent: true,
      }).returning();
      await tx.insert(communityChannelsTable).values({
        communityId: community.id,
        name: "Sesli sohbet",
        type: "voice",
        position: 1,
        voiceRoomId: rooms[0].id,
      });

      return community;
    });
    res.status(201).json(await communitySummary(created, req.user!.id));
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Topluluk oluşturulamadı." });
  }
});

router.post("/communities/:communityId/cover", requireAuth, communityCoverUpload.single("image"), async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    if (!communityId) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      res.status(400).json({ error: "Geçersiz topluluk." });
      return;
    }
    const context = await requirePermission(req, res, communityId, "manageCommunity");
    if (!context) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "JPG, PNG, WebP veya GIF biçiminde en fazla 8 MB bir kapak görseli seç." });
      return;
    }
    const coverImageUrl = `/api/uploads/community-covers/${req.file.filename}`;
    await db.update(communitiesTable).set({ coverImageUrl }).where(eq(communitiesTable.id, communityId));
    if (context.community.coverImageUrl?.startsWith("/api/uploads/community-covers/")) {
      fs.rm(path.join(communityCoverDir, path.basename(context.community.coverImageUrl)), () => {});
    }
    const [updated] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, communityId)).limit(1);
    res.json(await communitySummary(updated, req.user!.id));
  } catch (error) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    req.log.error(error);
    res.status(500).json({ error: "Topluluk kapağı kaydedilemedi." });
  }
});

router.get("/communities/invites/:code", async (req, res) => {
  try {
    await schemaReady;
    const [community] = await db.select().from(communitiesTable)
      .where(eq(communitiesTable.inviteCode, String(req.params.code)))
      .limit(1);
    if (!community) {
      res.status(404).json({ error: "Davet bağlantısı geçersiz veya süresi dolmuş." });
      return;
    }
    const summary = await communitySummary(community, req.user?.id);
    res.json(summary);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Davet bilgisi alınamadı." });
  }
});

async function joinWithInvite(code: string, userId: number) {
  const [community] = await db.select().from(communitiesTable)
    .where(eq(communitiesTable.inviteCode, code))
    .limit(1);
  if (!community) return null;
  const [role] = await db.select().from(communityRolesTable)
    .where(and(eq(communityRolesTable.communityId, community.id), eq(communityRolesTable.isDefault, true)))
    .limit(1);
  if (!role) throw new Error("Topluluk varsayılan rolü bulunamadı.");
  await addMember(community.id, userId, role.id, community.accessMode === "approval" ? "pending" : "active");
  return community;
}

router.post("/communities/invites/:code/join", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const community = await joinWithInvite(String(req.params.code), req.user!.id);
    if (!community) {
      res.status(404).json({ error: "Davet bağlantısı geçersiz veya süresi dolmuş." });
      return;
    }
    res.json(await communitySummary(community, req.user!.id));
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Davetle katılım tamamlanamadı." });
  }
});

router.get("/communities/:communityId", async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    if (!communityId) {
      res.status(400).json({ error: "Geçersiz topluluk." });
      return;
    }
    const context = req.user ? await getContext(communityId, req.user.id) : null;
    if (!context) {
      const [community] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, communityId)).limit(1);
      if (!community) {
        res.status(404).json({ error: "Topluluk bulunamadı." });
        return;
      }
      if (community.accessMode !== "public" && community.accessMode !== "approval") {
        res.status(403).json({ error: "Bu topluluğa yalnızca davetle katılabilirsin." });
        return;
      }
      const summary = await communitySummary(community, req.user?.id);
      res.json(summary.membershipStatus === "active"
        ? summary
        : { ...summary, channels: [] });
      return;
    }
    if (context.status === "none" && context.community.accessMode !== "public" && context.community.accessMode !== "approval") {
      res.status(403).json({ error: "Bu topluluğa yalnızca davetle katılabilirsin." });
      return;
    }
    const summary = await communitySummary(context.community, req.user!.id);
    if (context.status !== "active") {
      res.json({ ...summary, channels: [], roles: [], members: [], pendingMembers: [] });
      return;
    }
    const [roles, members, pendingMembers] = await Promise.all([
      db.select().from(communityRolesTable).where(eq(communityRolesTable.communityId, communityId)).orderBy(desc(communityRolesTable.position)),
      db.select({
        userId: communityMembersTable.userId,
        roleId: communityMembersTable.roleId,
        joinedAt: communityMembersTable.joinedAt,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
        roleName: communityRolesTable.name,
        roleColor: communityRolesTable.color,
      })
        .from(communityMembersTable)
        .innerJoin(usersTable, eq(communityMembersTable.userId, usersTable.id))
        .leftJoin(communityRolesTable, eq(communityMembersTable.roleId, communityRolesTable.id))
        .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.status, "active"))),
      hasPermission(context, req.user!.id, "manageMembers")
        ? db.select({
          userId: communityMembersTable.userId,
          username: usersTable.username,
          displayName: usersTable.displayName,
          avatarUrl: usersTable.avatarUrl,
          joinedAt: communityMembersTable.joinedAt,
        })
          .from(communityMembersTable)
          .innerJoin(usersTable, eq(communityMembersTable.userId, usersTable.id))
          .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.status, "pending")))
        : Promise.resolve([]),
    ]);
    res.json({ ...summary, roles, members, pendingMembers });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Topluluk bilgileri yüklenemedi." });
  }
});

router.post("/communities/:communityId/join", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    if (!communityId) {
      res.status(400).json({ error: "Geçersiz topluluk." });
      return;
    }
    const [community] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, communityId)).limit(1);
    if (!community) {
      res.status(404).json({ error: "Topluluk bulunamadı." });
      return;
    }
    const [role] = await db.select().from(communityRolesTable)
      .where(and(eq(communityRolesTable.communityId, communityId), eq(communityRolesTable.isDefault, true)))
      .limit(1);
    if (!role) {
      res.status(500).json({ error: "Topluluk rolü oluşturulamadı." });
      return;
    }
    const status = community.accessMode === "public" ? "active" : "pending";
    await addMember(communityId, req.user!.id, role.id, status);
    res.json({ success: true, status, communityId });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Katılım isteği gönderilemedi." });
  }
});

router.patch("/communities/:communityId/requests/:userId", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const userId = parseId(req.params.userId);
    const action = req.body?.action;
    if (!communityId || !userId || !["approve", "reject"].includes(action)) {
      res.status(400).json({ error: "Geçersiz katılım isteği." });
      return;
    }
    const context = await requirePermission(req, res, communityId, "manageMembers");
    if (!context) return;
    const [member] = await db.select().from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, userId), eq(communityMembersTable.status, "pending")))
      .limit(1);
    if (!member) {
      res.status(404).json({ error: "Bekleyen katılım isteği bulunamadı." });
      return;
    }
    if (action === "approve") {
      await db.update(communityMembersTable).set({ status: "active" })
        .where(eq(communityMembersTable.id, member.id));
    } else {
      await db.delete(communityMembersTable).where(eq(communityMembersTable.id, member.id));
    }
    res.json({ success: true });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Katılım isteği güncellenemedi." });
  }
});

router.delete("/communities/:communityId/members/:userId", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const userId = parseId(req.params.userId);
    if (!communityId || !userId) {
      res.status(400).json({ error: "Geçersiz üye." });
      return;
    }
    const context = await getContext(communityId, req.user!.id);
    if (!context || context.status !== "active") {
      res.status(404).json({ error: "Topluluk bulunamadı." });
      return;
    }
    if (userId !== req.user!.id && !hasPermission(context, req.user!.id, "manageMembers")) {
      res.status(403).json({ error: "Üyeyi çıkarma yetkin yok." });
      return;
    }
    if (context.community.createdBy === userId) {
      res.status(400).json({ error: "Topluluk sahibini çıkaramazsın." });
      return;
    }
    await db.delete(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, userId)));
    res.json({ success: true });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Üyelik güncellenemedi." });
  }
});

router.post("/communities/:communityId/roles", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const name = normalizeName(req.body?.name, 2, 24);
    const permissions = normalizePermissions(req.body?.permissions);
    const color = typeof req.body?.color === "string" && /^#[0-9a-fA-F]{6}$/.test(req.body.color) ? req.body.color : "#8b5cf6";
    if (!communityId || !name || !permissions) {
      res.status(400).json({ error: "Rol adı veya izinler geçerli değil." });
      return;
    }
    const context = await requirePermission(req, res, communityId, "manageRoles");
    if (!context) return;
    if (permissions.manageCommunity && context.community.createdBy !== req.user!.id) {
      res.status(403).json({ error: "Topluluk yönetimi yetkisini yalnızca kurucu verebilir." });
      return;
    }
    const existing = await db.select({ position: communityRolesTable.position }).from(communityRolesTable)
      .where(eq(communityRolesTable.communityId, communityId));
    const [role] = await db.insert(communityRolesTable).values({
      communityId,
      name,
      color,
      permissions,
      position: existing.reduce((max, item) => Math.max(max, item.position), 0) + 1,
    }).returning();
    res.status(201).json(role);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Rol oluşturulamadı." });
  }
});

router.patch("/communities/:communityId/roles/:roleId", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const roleId = parseId(req.params.roleId);
    const context = communityId ? await requirePermission(req, res, communityId, "manageRoles") : null;
    if (!communityId || !roleId || !context) {
      if (!communityId || !roleId) res.status(400).json({ error: "Geçersiz rol." });
      return;
    }
    const [role] = await db.select().from(communityRolesTable)
      .where(and(eq(communityRolesTable.id, roleId), eq(communityRolesTable.communityId, communityId)))
      .limit(1);
    if (!role) {
      res.status(404).json({ error: "Rol bulunamadı." });
      return;
    }
    const updates: Partial<typeof communityRolesTable.$inferInsert> = {};
    if (req.body?.name !== undefined) {
      const name = normalizeName(req.body.name, 2, 24);
      if (!name) {
        res.status(400).json({ error: "Rol adı 2–24 karakter olmalı." });
        return;
      }
      updates.name = name;
    }
    if (req.body?.color !== undefined) {
      if (typeof req.body.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(req.body.color)) {
        res.status(400).json({ error: "Rol rengi geçersiz." });
        return;
      }
      updates.color = req.body.color;
    }
    if (req.body?.permissions !== undefined) {
      const permissions = normalizePermissions(req.body.permissions);
      if (!permissions) {
        res.status(400).json({ error: "Rol izinleri geçersiz." });
        return;
      }
      if (permissions.manageCommunity && context.community.createdBy !== req.user!.id) {
        res.status(403).json({ error: "Topluluk yönetimi yetkisini yalnızca kurucu verebilir." });
        return;
      }
      updates.permissions = permissions;
    }
    if (Object.keys(updates).length) await db.update(communityRolesTable).set(updates).where(eq(communityRolesTable.id, roleId));
    const [updated] = await db.select().from(communityRolesTable).where(eq(communityRolesTable.id, roleId)).limit(1);
    res.json(updated);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Rol güncellenemedi." });
  }
});

router.delete("/communities/:communityId/roles/:roleId", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const roleId = parseId(req.params.roleId);
    if (!communityId || !roleId) {
      res.status(400).json({ error: "Geçersiz rol." });
      return;
    }
    const context = await requirePermission(req, res, communityId, "manageRoles");
    if (!context) return;
    const [role] = await db.select().from(communityRolesTable)
      .where(and(eq(communityRolesTable.id, roleId), eq(communityRolesTable.communityId, communityId)))
      .limit(1);
    if (!role) {
      res.status(404).json({ error: "Rol bulunamadı." });
      return;
    }
    if (role.isDefault) {
      res.status(400).json({ error: "Varsayılan Üye rolü silinemez." });
      return;
    }
    if (role.permissions.manageCommunity && context.community.createdBy !== req.user!.id) {
      res.status(403).json({ error: "Yönetici rolünü yalnızca kurucu silebilir." });
      return;
    }
    const [defaultRole] = await db.select().from(communityRolesTable)
      .where(and(eq(communityRolesTable.communityId, communityId), eq(communityRolesTable.isDefault, true)))
      .limit(1);
    if (!defaultRole) {
      res.status(500).json({ error: "Varsayılan Üye rolü bulunamadı." });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.update(communityMembersTable).set({ roleId: defaultRole.id })
        .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.roleId, roleId)));
      await tx.delete(communityRolesTable).where(eq(communityRolesTable.id, roleId));
    });
    res.json({ success: true });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Rol silinemedi." });
  }
});

router.patch("/communities/:communityId/members/:userId/role", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const userId = parseId(req.params.userId);
    const roleId = parseId(req.body?.roleId);
    if (!communityId || !userId || !roleId) {
      res.status(400).json({ error: "Geçersiz üye veya rol." });
      return;
    }
    const context = await requirePermission(req, res, communityId, "manageMembers");
    if (!context) return;
    const [role] = await db.select().from(communityRolesTable)
      .where(and(eq(communityRolesTable.id, roleId), eq(communityRolesTable.communityId, communityId)))
      .limit(1);
    if (!role) {
      res.status(404).json({ error: "Bu topluluğa ait rol bulunamadı." });
      return;
    }
    if (role.permissions.manageCommunity && context.community.createdBy !== req.user!.id) {
      res.status(403).json({ error: "Topluluk yönetimi yetkisini yalnızca kurucu verebilir." });
      return;
    }
    const [member] = await db.select().from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, userId), eq(communityMembersTable.status, "active")))
      .limit(1);
    if (!member) {
      res.status(404).json({ error: "Aktif üye bulunamadı." });
      return;
    }
    await db.update(communityMembersTable).set({ roleId }).where(eq(communityMembersTable.id, member.id));
    res.json({ success: true });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Üye rolü güncellenemedi." });
  }
});

router.post("/communities/:communityId/channels", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const name = normalizeName(req.body?.name, 2, 32);
    const type = req.body?.type;
    if (!communityId || !name || (type !== "text" && type !== "voice")) {
      res.status(400).json({ error: "Kanal adı veya türü geçersiz." });
      return;
    }
    const context = await requirePermission(req, res, communityId, "manageChannels");
    if (!context) return;
    const channels = await db.select({ position: communityChannelsTable.position })
      .from(communityChannelsTable).where(eq(communityChannelsTable.communityId, communityId));
    const channel = await insertChannel(
      communityId,
      req.user!.id,
      name.toLocaleLowerCase("tr-TR").replace(/\s+/g, "-"),
      type,
      channels.reduce((max, item) => Math.max(max, item.position), -1) + 1,
    );
    res.status(201).json(channel);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Kanal oluşturulamadı." });
  }
});

router.patch("/communities/:communityId/channels/reorder", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const channelIds: number[] | null = Array.isArray(req.body?.channelIds)
      && req.body.channelIds.every((id: unknown) => Number.isSafeInteger(id) && Number(id) > 0)
      ? req.body.channelIds
      : null;
    if (!communityId || !channelIds) {
      res.status(400).json({ error: "Kanal sıralaması geçersiz." });
      return;
    }
    const context = await requirePermission(req, res, communityId, "manageChannels");
    if (!context) return;
    const channels = await db.select({ id: communityChannelsTable.id })
      .from(communityChannelsTable)
      .where(eq(communityChannelsTable.communityId, communityId));
    if (channelIds.length !== channels.length || new Set(channelIds).size !== channels.length
      || channels.some((channel) => !channelIds.includes(channel.id))) {
      res.status(400).json({ error: "Tüm topluluk kanalları sıralamada bulunmalı." });
      return;
    }
    await db.transaction(async (tx) => {
      for (const [position, id] of channelIds.entries()) {
        await tx.update(communityChannelsTable)
        .set({ position })
        .where(and(eq(communityChannelsTable.communityId, communityId), eq(communityChannelsTable.id, id)));
      }
    });
    res.json({ success: true });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Kanalların sıralaması kaydedilemedi." });
  }
});

router.delete("/communities/:communityId/channels/:channelId", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const channelId = parseId(req.params.channelId);
    if (!communityId || !channelId) {
      res.status(400).json({ error: "Geçersiz kanal." });
      return;
    }
    const context = await requirePermission(req, res, communityId, "manageChannels");
    if (!context) return;
    const [channel] = await db.select().from(communityChannelsTable)
      .where(and(eq(communityChannelsTable.id, channelId), eq(communityChannelsTable.communityId, communityId)))
      .limit(1);
    if (!channel) {
      res.status(404).json({ error: "Kanal bulunamadı." });
      return;
    }
    await db.transaction(async (tx) => {
      if (channel.voiceRoomId) {
        await tx.delete(voiceRoomsTable).where(eq(voiceRoomsTable.id, channel.voiceRoomId));
      }
      await tx.delete(communityChannelsTable).where(eq(communityChannelsTable.id, channelId));
    });
    res.json({ success: true });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Kanal silinemedi." });
  }
});

router.get("/communities/:communityId/channels/:channelId/messages", async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const channelId = parseId(req.params.channelId);
    if (!communityId || !channelId) {
      res.status(400).json({ error: "Geçersiz kanal." });
      return;
    }
    const context = req.user ? await getContext(communityId, req.user.id) : null;
    if (!context || context.status !== "active") {
      res.status(403).json({ error: "Yalnızca topluluk üyeleri sohbeti görebilir." });
      return;
    }
    const [channel] = await db.select().from(communityChannelsTable)
      .where(and(eq(communityChannelsTable.id, channelId), eq(communityChannelsTable.communityId, communityId)))
      .limit(1);
    if (!channel || channel.type !== "text") {
      res.status(404).json({ error: "Yazı kanalı bulunamadı." });
      return;
    }
    const messages = await db.select({
      id: communityMessagesTable.id,
      content: communityMessagesTable.content,
      createdAt: communityMessagesTable.createdAt,
      senderId: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    })
      .from(communityMessagesTable)
      .innerJoin(usersTable, eq(communityMessagesTable.senderId, usersTable.id))
      .where(eq(communityMessagesTable.channelId, channelId))
      .orderBy(desc(communityMessagesTable.id))
      .limit(100);
    res.json(messages.reverse());
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Mesajlar yüklenemedi." });
  }
});

router.post("/communities/:communityId/channels/:channelId/messages", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const channelId = parseId(req.params.channelId);
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!communityId || !channelId || !content || content.length > 2000) {
      res.status(400).json({ error: "Mesaj 1–2000 karakter olmalı." });
      return;
    }
    const context = await getContext(communityId, req.user!.id);
    if (!context || context.status !== "active") {
      res.status(403).json({ error: "Bu topluluğa erişimin yok." });
      return;
    }
    if (!hasPermission(context, req.user!.id, "sendMessages")) {
      res.status(403).json({ error: "Bu kanalda yalnızca yetkili roller mesaj gönderebilir." });
      return;
    }
    const [channel] = await db.select().from(communityChannelsTable)
      .where(and(eq(communityChannelsTable.id, channelId), eq(communityChannelsTable.communityId, communityId)))
      .limit(1);
    if (!channel || channel.type !== "text") {
      res.status(404).json({ error: "Yazı kanalı bulunamadı." });
      return;
    }
    const [message] = await db.insert(communityMessagesTable)
      .values({ channelId, senderId: req.user!.id, content })
      .returning();
    res.status(201).json({
      ...message,
      sender: {
        id: req.user!.id,
        username: req.user!.username,
        displayName: req.user!.displayName,
        avatarUrl: req.user!.avatarUrl,
      },
    });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Mesaj gönderilemedi." });
  }
});

router.delete("/communities/:communityId/channels/:channelId/messages/:messageId", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const channelId = parseId(req.params.channelId);
    const messageId = parseId(req.params.messageId);
    if (!communityId || !channelId || !messageId) {
      res.status(400).json({ error: "Geçersiz mesaj." });
      return;
    }
    const context = await requirePermission(req, res, communityId, "manageMessages");
    if (!context) return;
    const [message] = await db.select({ id: communityMessagesTable.id })
      .from(communityMessagesTable)
      .innerJoin(communityChannelsTable, eq(communityMessagesTable.channelId, communityChannelsTable.id))
      .where(and(
        eq(communityMessagesTable.id, messageId),
        eq(communityChannelsTable.id, channelId),
        eq(communityChannelsTable.communityId, communityId),
      ))
      .limit(1);
    if (!message) {
      res.status(404).json({ error: "Mesaj bulunamadı." });
      return;
    }
    await db.delete(communityMessagesTable).where(eq(communityMessagesTable.id, messageId));
    res.json({ success: true });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Mesaj silinemedi." });
  }
});

router.get("/communities/:communityId/invite", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    if (!communityId) {
      res.status(400).json({ error: "Geçersiz topluluk." });
      return;
    }
    const context = await requirePermission(req, res, communityId, "inviteMembers");
    if (!context) return;
    res.json({ inviteCode: context.community.inviteCode });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Davet bağlantısı alınamadı." });
  }
});

router.post("/communities/:communityId/voice/:channelId/join", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const channelId = parseId(req.params.channelId);
    if (!communityId || !channelId) {
      res.status(400).json({ error: "Geçersiz ses kanalı." });
      return;
    }
    const context = await getContext(communityId, req.user!.id);
    if (!context || context.status !== "active") {
      res.status(403).json({ error: "Bu topluluğa erişimin yok." });
      return;
    }
    if (!hasPermission(context, req.user!.id, "connectVoice")) {
      res.status(403).json({ error: "Sesli kanala katılma yetkin yok." });
      return;
    }
    const [channel] = await db.select().from(communityChannelsTable)
      .where(and(eq(communityChannelsTable.id, channelId), eq(communityChannelsTable.communityId, communityId)))
      .limit(1);
    if (!channel || channel.type !== "voice" || !channel.voiceRoomId) {
      res.status(404).json({ error: "Sesli kanal bulunamadı." });
      return;
    }
    const [participant] = await db.select({ id: voiceRoomParticipantsTable.id })
      .from(voiceRoomParticipantsTable)
      .where(and(eq(voiceRoomParticipantsTable.roomId, channel.voiceRoomId), eq(voiceRoomParticipantsTable.userId, req.user!.id)))
      .limit(1);
    if (!participant) {
      await db.insert(voiceRoomParticipantsTable).values({ roomId: channel.voiceRoomId, userId: req.user!.id });
    }
    res.json({ roomId: channel.voiceRoomId });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Sesli kanala katılınamadı." });
  }
});

router.post("/communities/:communityId/voice/:channelId/leave", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    const channelId = parseId(req.params.channelId);
    if (!communityId || !channelId) {
      res.status(400).json({ error: "Geçersiz ses kanalı." });
      return;
    }
    const context = await getContext(communityId, req.user!.id);
    if (!context || context.status !== "active") {
      res.status(403).json({ error: "Bu topluluğa erişimin yok." });
      return;
    }
    const [channel] = await db.select().from(communityChannelsTable)
      .where(and(eq(communityChannelsTable.id, channelId), eq(communityChannelsTable.communityId, communityId)))
      .limit(1);
    if (!channel?.voiceRoomId) {
      res.status(404).json({ error: "Sesli kanal bulunamadı." });
      return;
    }
    await db.delete(voiceRoomParticipantsTable)
      .where(and(eq(voiceRoomParticipantsTable.roomId, channel.voiceRoomId), eq(voiceRoomParticipantsTable.userId, req.user!.id)));
    res.json({ success: true });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Sesli kanaldan ayrılamadın." });
  }
});

router.patch("/communities/:communityId", requireAuth, async (req, res) => {
  try {
    await schemaReady;
    const communityId = parseId(req.params.communityId);
    if (!communityId) {
      res.status(400).json({ error: "Geçersiz topluluk." });
      return;
    }
    const context = await requirePermission(req, res, communityId, "manageCommunity");
    if (!context) return;
    const updates: Partial<typeof communitiesTable.$inferInsert> = {};
    if (req.body?.name !== undefined) {
      const name = normalizeName(req.body.name, 2, 32);
      if (!name) {
        res.status(400).json({ error: "Topluluk adı 2–32 karakter olmalı." });
        return;
      }
      updates.name = name;
    }
    if (req.body?.description !== undefined) {
      if (typeof req.body.description !== "string" || req.body.description.length > 240) {
        res.status(400).json({ error: "Açıklama en fazla 240 karakter olabilir." });
        return;
      }
      updates.description = req.body.description.trim();
    }
    if (req.body?.emoji !== undefined) {
      if (typeof req.body.emoji !== "string" || [...req.body.emoji].length > 4) {
        res.status(400).json({ error: "Topluluk simgesi geçersiz." });
        return;
      }
      updates.emoji = req.body.emoji;
    }
    if (req.body?.accentColor !== undefined) {
      const accentColors = ["#8b5cf6", "#ec4899", "#f59e0b", "#14b8a6", "#3b82f6", "#f97316"];
      if (typeof req.body.accentColor !== "string" || !accentColors.includes(req.body.accentColor)) {
        res.status(400).json({ error: "Topluluk vurgu rengi geçersiz." });
        return;
      }
      updates.accentColor = req.body.accentColor;
    }
    if (req.body?.accessMode !== undefined) {
      if (req.body.accessMode !== "public" && req.body.accessMode !== "approval") {
        res.status(400).json({ error: "Katılım türü geçersiz." });
        return;
      }
      updates.accessMode = req.body.accessMode;
    }
    if (Object.keys(updates).length) {
      await db.update(communitiesTable).set(updates).where(eq(communitiesTable.id, communityId));
    }
    const [updated] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, communityId)).limit(1);
    res.json(await communitySummary(updated, req.user!.id));
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Topluluk ayarları güncellenemedi." });
  }
});

export default router;
