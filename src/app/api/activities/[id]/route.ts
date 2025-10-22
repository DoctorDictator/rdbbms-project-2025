import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// GET /api/activities/[id] - Get a specific activity by ID
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

    // Find the activity
    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        file: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!activity) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    // Only the owner can view their activity
    if (activity.userId !== decoded.userId) {
      return NextResponse.json(
        { error: "You don't have permission to view this activity" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        activity: {
          id: activity.id,
          userId: activity.userId,
          fileId: activity.fileId,
          action: activity.action,
          createdAt: activity.createdAt.toISOString(),
          file: activity.file,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get activity error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
