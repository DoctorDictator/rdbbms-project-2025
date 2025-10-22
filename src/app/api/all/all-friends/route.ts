import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/all/all-friends - Get all friendships in the database
export async function GET(request: NextRequest) {
  try {
    const friendships = await prisma.friendship.findMany({
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
      orderBy: { createdAt: "asc" },
    });

    // Flatten to "other user" row for each friendship
    const friends = friendships
      .map((f) => {
        // Show both sides for admin view
        return [
          {
            id: f.user.id,
            username: f.user.username,
            name: f.user.name,
            email: f.user.email,
            status: f.status,
            friendshipId: f.id,
            createdAt: f.createdAt.toISOString(),
            updatedAt: f.updatedAt.toISOString(),
          },
          {
            id: f.friend.id,
            username: f.friend.username,
            name: f.friend.name,
            email: f.friend.email,
            status: f.status,
            friendshipId: f.id,
            createdAt: f.createdAt.toISOString(),
            updatedAt: f.updatedAt.toISOString(),
          },
        ];
      })
      .flat();

    return NextResponse.json({ friends }, { status: 200 });
  } catch (error) {
    console.error("Get all friends error:", error);
    return NextResponse.json(
      { error: "Failed to fetch friends" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
