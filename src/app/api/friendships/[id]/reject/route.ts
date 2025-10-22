import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// POST /api/friendships/[id]/reject - Reject a friend request by friendship ID
export async function POST(
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
        { error: "Friend request not found" },
        { status: 404 }
      );
    }

    // Only the recipient can reject the request
    if (friendship.friendId !== decoded.userId) {
      return NextResponse.json(
        { error: "You don't have permission to reject this request" },
        { status: 403 }
      );
    }

    // Only pending requests can be rejected
    if (friendship.status !== "PENDING") {
      return NextResponse.json(
        { error: "This friend request is not pending" },
        { status: 400 }
      );
    }

    // Reject the friend request
    const updatedFriendship = await prisma.friendship.update({
      where: { id },
      data: { status: "REJECTED" },
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
      {
        message: "Friend request rejected successfully",
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
    console.error("Reject friend request error:", error);
    return NextResponse.json(
      { error: "Failed to reject friend request" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
