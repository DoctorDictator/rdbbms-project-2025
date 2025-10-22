import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// GET /api/trash/[id] - Get a specific trashed file by trash ID
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

    // Get trash entry with file details
    const trash = await prisma.trash.findUnique({
      where: { id },
      include: {
        file: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                name: true,
                email: true,
              },
            },
            favourites: {
              where: {
                userId: decoded.userId,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            name: true,
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

    // Check if user owns this trash entry
    if (trash.userId !== decoded.userId) {
      return NextResponse.json(
        { error: "You don't have permission to view this trash entry" },
        { status: 403 }
      );
    }

    // Transform response
    const transformedTrash = {
      id: trash.id,
      userId: trash.userId,
      deletedAt: trash.deletedAt.toISOString(),
      user: trash.user,
      file: {
        id: trash.file.id,
        title: trash.file.title,
        content: trash.file.content,
        isFavorite: trash.file.favourites.length > 0,
        isTrashed: true,
        owner: trash.file.owner,
        createdAt: trash.file.createdAt.toISOString(),
        updatedAt: trash.file.updatedAt.toISOString(),
      },
    };

    return NextResponse.json({ trash: transformedTrash }, { status: 200 });
  } catch (error) {
    console.error("Get trash entry error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trash entry" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/trash/[id] - Permanently delete a file from trash by trash ID
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
        { error: "You don't have permission to delete this trash entry" },
        { status: 403 }
      );
    }

    // Only delete if user owns the file
    if (trash.file.ownerId !== decoded.userId) {
      return NextResponse.json(
        { error: "You can only permanently delete files you own" },
        { status: 403 }
      );
    }

    // Delete file permanently (cascade will remove trash entry)
    await prisma.file.delete({
      where: { id: trash.fileId },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        userId: decoded.userId,
        fileId: null,
        action: "FILE_DELETED",
      },
    });

    return NextResponse.json(
      {
        message: "File permanently deleted from trash",
        fileId: trash.fileId,
        fileTitle: trash.file.title,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete from trash error:", error);
    return NextResponse.json(
      { error: "Failed to delete from trash" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/trash/[id] - Restore a file from trash by trash ID
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

    // Check if trash entry exists and belongs to user
    const trash = await prisma.trash.findUnique({
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
