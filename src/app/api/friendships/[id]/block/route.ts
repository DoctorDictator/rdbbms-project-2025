import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, ActivityType } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// POST /api/friendships/[id]/block - Block a friendship by ID
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // Await params if it's a Promise

    // Get token from cookie
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as { userId: string };

    // Find the friendship
    const friendship = await prisma.friendship.findUnique({
      where: { id },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: "Friendship not found" },
        { status: 404 }
      );
    }

    // Only involved users can block
    if (
      friendship.userId !== decoded.userId &&
      friendship.friendId !== decoded.userId
    ) {
      return NextResponse.json(
        { error: "You don't have permission to block this friendship" },
        { status: 403 }
      );
    }

    // Block the friendship
    const updatedFriendship = await prisma.friendship.update({
      where: { id },
      data: { status: "BLOCKED" },
    });

    // Create activity (use enum value, not string)
    await prisma.activity.create({
      data: {
        userId: decoded.userId,
        fileId: null,
        action: ActivityType.FRIENDSHIP_BLOCKED,
      },
    });

    return NextResponse.json(
      {
        message: "Friendship blocked successfully",
        friendship: {
          id: updatedFriendship.id,
          userId: updatedFriendship.userId,
          friendId: updatedFriendship.friendId,
          status: updatedFriendship.status,
          createdAt: updatedFriendship.createdAt.toISOString(),
          updatedAt: updatedFriendship.updatedAt.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Block friendship error:", error);
    return NextResponse.json(
      { error: "Failed to block friendship" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
