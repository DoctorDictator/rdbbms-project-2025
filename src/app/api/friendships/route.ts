import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// Helper to clean undefined keys from where clause
function cleanWhereClause(where: Record<string, unknown>) {
  const cleaned: Record<string, unknown> = {};
  Object.keys(where).forEach((key) => {
    if (where[key] !== undefined) cleaned[key] = where[key];
  });
  return cleaned;
}

// GET /api/friendships - Get all friendships for authenticated user
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as { userId: string };

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const sent = searchParams.get("sent") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const whereClause: Record<string, unknown> = {};

    if (sent) {
      whereClause.userId = decoded.userId;
    } else {
      whereClause.OR = [
        { userId: decoded.userId },
        { friendId: decoded.userId },
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    // Clean undefined keys for count
    const countWhereClause = cleanWhereClause(whereClause);

    const friendships = await prisma.friendship.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
          },
        },
        friend: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Map to friend info for frontend
    const friends = friendships.map((f) => {
      const isUser = f.userId === decoded.userId;
      const other = isUser ? f.friend : f.user;
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

    const totalCount = await prisma.friendship.count({
      where: countWhereClause,
    });

    return NextResponse.json(
      {
        friends,
        total: totalCount,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get friendships error:", error);
    return NextResponse.json(
      { error: "Failed to fetch friends" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/friendships - Send a friend request
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as { userId: string };

    const body = await request.json();
    const { friendUsername, friendEmail, identifier } = body;

    const searchValue = identifier || friendUsername || friendEmail;
    if (!searchValue) {
      return NextResponse.json(
        { error: "Friend username or email is required" },
        { status: 400 }
      );
    }

    const friendUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: searchValue }, { email: searchValue }],
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
      },
    });

    if (!friendUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (friendUser.id === decoded.userId) {
      return NextResponse.json(
        { error: "You cannot send a friend request to yourself" },
        { status: 400 }
      );
    }

    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          {
            userId: decoded.userId,
            friendId: friendUser.id,
          },
          {
            userId: friendUser.id,
            friendId: decoded.userId,
          },
        ],
      },
    });

    if (existingFriendship) {
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
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
          },
        },
        friend: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await prisma.activity.create({
      data: {
        userId: decoded.userId,
        fileId: null,
        action: "FRIEND_REQUEST_SENT",
      },
    });

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
  } finally {
    await prisma.$disconnect();
  }
}
