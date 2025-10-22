import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Extract clean email or fallback username from free-form text (e.g. "Harsh <harsh@x.com> - note")
function parseIdentifier(raw: string): { email?: string; username?: string } {
  const s = (raw ?? "").trim();
  const emailMatch = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch) return { email: emailMatch[0].toLowerCase() };

  const token = s
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)[0];
  if (token) return { username: token.replace(/^[<"'(]+|[>"')]+$/g, "") };

  return {};
}

// GET /api/friendships
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as { userId: string };
    const searchParams = request.nextUrl.searchParams;

    const statusParam = searchParams.get("status") as
      | Prisma.FriendshipScalarWhereInput["status"]
      | null;
    const sent = searchParams.get("sent") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build ONE typed where used for both findMany and count
    let where: Prisma.FriendshipWhereInput;
    if (sent) {
      where = {
        userId: decoded.userId,
        ...(statusParam ? { status: statusParam } : {}),
      };
    } else {
      where = {
        OR: [{ userId: decoded.userId }, { friendId: decoded.userId }],
        ...(statusParam ? { status: statusParam } : {}),
      };
    }

    const friendships = await prisma.friendship.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, name: true, email: true } },
        friend: {
          select: { id: true, username: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Shape into "other user" rows
    const friends = friendships.map((f) => {
      const isRequester = f.userId === decoded.userId;
      const other = isRequester ? f.friend : f.user;
      return {
        id: other.id,
        username: other.username,
        name: other.name,
        email: other.email,
        status: f.status,
        friendshipId: f.id,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      };
    });

    const totalCount = await prisma.friendship.count({ where });

    return NextResponse.json(
      {
        friends,
        total: totalCount,
        pagination: { limit, offset, hasMore: offset + limit < totalCount },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get friendships error:", error);
    return NextResponse.json(
      { error: "Failed to fetch friends" },
      { status: 500 }
    );
  }
}

// POST /api/friendships - Send a friend request (identifier can be messy)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as { userId: string };

    const body = await request.json().catch(() => ({}));
    const { friendUsername, friendEmail, identifier } = body ?? {};

    const raw = identifier || friendUsername || friendEmail;
    if (!raw) {
      return NextResponse.json(
        { error: "Friend username or email is required" },
        { status: 400 }
      );
    }

    const { email, username } = parseIdentifier(String(raw));

    const friendUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email
            ? [{ email: { equals: email, mode: "insensitive" as const } }]
            : []),
          ...(username
            ? [{ username: { equals: username, mode: "insensitive" as const } }]
            : []),
        ],
      },
      select: { id: true, username: true, name: true, email: true },
    });

    if (!friendUser)
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (friendUser.id === decoded.userId) {
      return NextResponse.json(
        { error: "You cannot send a friend request to yourself" },
        { status: 400 }
      );
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: decoded.userId, friendId: friendUser.id },
          { userId: friendUser.id, friendId: decoded.userId },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Friendship or request already exists" },
        { status: 400 }
      );
    }

    const friendship = await prisma.friendship.create({
      data: {
        userId: decoded.userId,
        friendId: friendUser.id,
        status: "PENDING",
      },
      include: {
        user: { select: { id: true, username: true, name: true, email: true } },
        friend: {
          select: { id: true, username: true, name: true, email: true },
        },
      },
    });

    // Non-blocking activity
    prisma.activity
      .create({
        data: {
          userId: decoded.userId,
          fileId: null,
          action: "FRIEND_REQUEST_SENT",
        },
      })
      .catch(() => {});

    return NextResponse.json(
      {
        message: "Friend request sent successfully",
        friendship: {
          id: friendship.id,
          userId: friendship.userId,
          friendId: friendship.friendId,
          status: friendship.status,
          user: friendship.user,
          friend: friendship.friend,
          createdAt: friendship.createdAt,
          updatedAt: friendship.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Send friend request error:", error);
    return NextResponse.json(
      { error: "Failed to send friend request" },
      { status: 500 }
    );
  }
}
