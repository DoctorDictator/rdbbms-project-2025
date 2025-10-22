import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// GET /api/friendships/[id] - Get a specific friendship by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    if (!friendship) {
      return NextResponse.json(
        { error: "Friendship not found" },
        { status: 404 }
      );
    }

    // Only involved users can view
    if (
      friendship.userId !== decoded.userId &&
      friendship.friendId !== decoded.userId
    ) {
      return NextResponse.json(
        { error: "You don't have permission to view this friendship" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        friendship: {
          id: friendship.id,
          userId: friendship.userId,
          friendId: friendship.friendId,
          status: friendship.status,
          user: friendship.user,
          friend: friendship.friend,
          createdAt: friendship.createdAt.toISOString(),
          updatedAt: friendship.updatedAt.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get friendship error:", error);
    return NextResponse.json(
      { error: "Failed to fetch friendship" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/friendships/[id] - Remove a specific friendship by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Only involved users can delete
    if (
      friendship.userId !== decoded.userId &&
      friendship.friendId !== decoded.userId
    ) {
      return NextResponse.json(
        { error: "You don't have permission to remove this friendship" },
        { status: 403 }
      );
    }

    await prisma.friendship.delete({
      where: { id },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        userId: decoded.userId,
        fileId: null,
        action: "FRIEND_REQUEST_REJECTED",
      },
    });

    return NextResponse.json(
      { message: "Friendship removed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Remove friendship error:", error);
    return NextResponse.json(
      { error: "Failed to remove friendship" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
