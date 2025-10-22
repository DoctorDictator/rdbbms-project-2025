import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// POST /api/trash/[id]/restore - Restore a file from trash by trash ID
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

    // Check if trash entry exists and belongs to user
    const trash = await prisma.trash.findUnique({
      where: { id },
      include: {
        file: {
          select: {
            id: true,
            title: true,
            ownerId: true,
          },
        },
      },
    });

    if (!trash) {
      return NextResponse.json(
        { error: "Trash entry not found" },
        { status: 404 }
      );
    }

    if (trash.userId !== decoded.userId) {
      return NextResponse.json(
        { error: "You don't have permission to restore this file" },
        { status: 403 }
      );
    }

    // Restore file (delete from trash table)
    await prisma.trash.delete({
      where: { id },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        userId: decoded.userId,
        fileId: trash.fileId,
        action: "FILE_RESTORED",
      },
    });

    return NextResponse.json(
      {
        message: "File restored from trash successfully",
        fileId: trash.fileId,
        fileTitle: trash.file.title,
        restoredAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Restore from trash error:", error);
    return NextResponse.json(
      { error: "Failed to restore from trash" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/trash/[id]/restore - Alternative method (same as POST)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Reuse POST logic
  return POST(request, { params });
}
