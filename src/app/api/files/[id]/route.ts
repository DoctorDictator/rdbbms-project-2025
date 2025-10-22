import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// GET /api/files/[id] - Get a single file by ID
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

    // Get file with favorites and trash info
    const file = await prisma.file.findUnique({
      where: { id },
      include: {
        favourites: {
          where: {
            userId: decoded.userId,
          },
        },
        trash: {
          where: {
            userId: decoded.userId,
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check if user owns the file or has access to it
    if (file.ownerId !== decoded.userId) {
      // Check if file is shared with user
      const share = await prisma.fileShare.findUnique({
        where: {
          fileId_sharedWithId: {
            fileId: id,
            sharedWithId: decoded.userId,
          },
        },
      });

      if (!share) {
        return NextResponse.json(
          { error: "You don't have permission to view this file" },
          { status: 403 }
        );
      }
    }

    // Transform file to include isFavorite and isTrashed flags
    const transformedFile = {
      id: file.id,
      title: file.title,
      content: file.content,
      isFavorite: file.favourites.length > 0,
      isTrashed: file.trash.length > 0,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      userId: file.ownerId,
    };

    return NextResponse.json({ file: transformedFile }, { status: 200 });
  } catch (error) {
    console.error("Get file error:", error);
    return NextResponse.json(
      { error: "Failed to fetch file" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/files/[id] - Update a file
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

    const body = await request.json();
    const { title, content } = body;

    // Check if file exists and user has permission
    const existingFile = await prisma.file.findUnique({
      where: { id },
    });

    if (!existingFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check if user owns the file or has EDIT permission
    if (existingFile.ownerId !== decoded.userId) {
      const share = await prisma.fileShare.findUnique({
        where: {
          fileId_sharedWithId: {
            fileId: id,
            sharedWithId: decoded.userId,
          },
        },
      });

      if (!share || share.permission !== "EDIT") {
        return NextResponse.json(
          { error: "You don't have permission to edit this file" },
          { status: 403 }
        );
      }
    }

    // Validate input
    if (title !== undefined && title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 }
      );
    }

    if (content !== undefined && content.trim().length === 0) {
      return NextResponse.json(
        { error: "Content cannot be empty" },
        { status: 400 }
      );
    }

    // Update file
    const updatedFile = await prisma.file.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(content !== undefined && { content: content.trim() }),
      },
      include: {
        favourites: {
          where: {
            userId: decoded.userId,
          },
        },
        trash: {
          where: {
            userId: decoded.userId,
          },
        },
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        userId: decoded.userId,
        fileId: id,
        action: "FILE_UPDATED",
      },
    });

    // Transform file
    const transformedFile = {
      id: updatedFile.id,
      title: updatedFile.title,
      content: updatedFile.content,
      isFavorite: updatedFile.favourites.length > 0,
      isTrashed: updatedFile.trash.length > 0,
      createdAt: updatedFile.createdAt.toISOString(),
      updatedAt: updatedFile.updatedAt.toISOString(),
      userId: updatedFile.ownerId,
    };

    return NextResponse.json(
      {
        message: "File updated successfully",
        file: transformedFile,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update file error:", error);
    return NextResponse.json(
      { error: "Failed to update file" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/files/[id] - Delete a file permanently
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

    // Check if file exists and user owns it
    const existingFile = await prisma.file.findUnique({
      where: { id },
    });

    if (!existingFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (existingFile.ownerId !== decoded.userId) {
      return NextResponse.json(
        { error: "You don't have permission to delete this file" },
        { status: 403 }
      );
    }

    // Delete file (this will cascade delete all related records)
    await prisma.file.delete({
      where: { id },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        userId: decoded.userId,
        fileId: null, // File is deleted, so no fileId reference
        action: "FILE_DELETED",
      },
    });

    return NextResponse.json(
      { message: "File deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
