import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// PATCH /api/files/[id]/trash - Toggle trash status for a file
export async function PATCH(
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

    // Check if file exists and user owns it
    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (file.ownerId !== decoded.userId) {
      return NextResponse.json(
        { error: "You don't have permission to modify this file" },
        { status: 403 }
      );
    }

    // Check if already in trash
    const existingTrash = await prisma.trash.findUnique({
      where: {
        userId_fileId: {
          userId: decoded.userId,
          fileId: id,
        },
      },
    });

    let isTrashed: boolean;

    if (existingTrash) {
      // Remove from trash (restore)
      await prisma.trash.delete({
        where: { id: existingTrash.id },
      });

      // Create activity
      await prisma.activity.create({
        data: {
          userId: decoded.userId,
          fileId: id,
          action: "FILE_RESTORED",
        },
      });

      isTrashed = false;
    } else {
      // Add to trash
      await prisma.trash.create({
        data: {
          userId: decoded.userId,
          fileId: id,
        },
      });

      // Create activity
      await prisma.activity.create({
        data: {
          userId: decoded.userId,
          fileId: id,
          action: "FILE_TRASHED",
        },
      });

      isTrashed = true;
    }

    return NextResponse.json(
      {
        message: isTrashed ? "Moved to trash" : "Restored from trash",
        isTrashed,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Toggle trash error:", error);
    return NextResponse.json(
      { error: "Failed to toggle trash status" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
