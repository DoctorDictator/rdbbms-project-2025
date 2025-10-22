import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// GET /api/shares/[id] - Get a specific share by share ID
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

    // Get share with file and user details
    const share = await prisma.fileShare.findUnique({
      where: { id },
      include: {
        file: {
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        owner: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
          },
        },
        sharedWith: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // Check if user is involved in this share (owner or recipient)
    if (
      share.ownerId !== decoded.userId &&
      share.sharedWithId !== decoded.userId
    ) {
      return NextResponse.json(
        { error: "You don't have permission to view this share" },
        { status: 403 }
      );
    }

    // Transform response
    const transformedShare = {
      id: share.id,
      fileId: share.fileId,
      ownerId: share.ownerId,
      sharedWithId: share.sharedWithId,
      permission: share.permission,
      createdAt: share.createdAt.toISOString(),
      file: {
        id: share.file.id,
        title: share.file.title,
        content: share.file.content,
        createdAt: share.file.createdAt.toISOString(),
        updatedAt: share.file.updatedAt.toISOString(),
      },
      owner: share.owner,
      sharedWith: share.sharedWith,
    };

    return NextResponse.json({ share: transformedShare }, { status: 200 });
  } catch (error) {
    console.error("Get share error:", error);
    return NextResponse.json(
      { error: "Failed to fetch share" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/shares/[id] - Update share permission
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
    const { permission } = body;

    // Validate permission
    if (!permission || !["VIEW", "EDIT"].includes(permission)) {
      return NextResponse.json(
        { error: "Invalid permission. Must be VIEW or EDIT" },
        { status: 400 }
      );
    }

    // Check if share exists and user owns it
    const existingShare = await prisma.fileShare.findUnique({
      where: { id },
      include: {
        file: {
          select: {
            id: true,
            title: true,
          },
        },
        sharedWith: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    if (!existingShare) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    if (existingShare.ownerId !== decoded.userId) {
      return NextResponse.json(
        { error: "You don't have permission to update this share" },
        { status: 403 }
      );
    }

    // Update share permission
    const updatedShare = await prisma.fileShare.update({
      where: { id },
      data: { permission },
      include: {
        file: {
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        owner: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        sharedWith: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        userId: decoded.userId,
        fileId: updatedShare.fileId,
        action: "FILE_SHARED", // Using FILE_SHARED for permission update
      },
    });

    // Transform response
    const transformedShare = {
      id: updatedShare.id,
      fileId: updatedShare.fileId,
      ownerId: updatedShare.ownerId,
      sharedWithId: updatedShare.sharedWithId,
      permission: updatedShare.permission,
      createdAt: updatedShare.createdAt.toISOString(),
      file: {
        id: updatedShare.file.id,
        title: updatedShare.file.title,
        content: updatedShare.file.content,
        createdAt: updatedShare.file.createdAt.toISOString(),
        updatedAt: updatedShare.file.updatedAt.toISOString(),
      },
      owner: updatedShare.owner,
      sharedWith: updatedShare.sharedWith,
    };

    return NextResponse.json(
      {
        message: "Share permission updated successfully",
        share: transformedShare,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update share error:", error);
    return NextResponse.json(
      { error: "Failed to update share" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/shares/[id] - Remove a share (unshare file)
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

    // Check if share exists and user owns it
    const existingShare = await prisma.fileShare.findUnique({
      where: { id },
      include: {
        file: {
          select: {
            id: true,
            title: true,
          },
        },
        sharedWith: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    if (!existingShare) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // Allow both owner and recipient to remove the share
    if (
      existingShare.ownerId !== decoded.userId &&
      existingShare.sharedWithId !== decoded.userId
    ) {
      return NextResponse.json(
        { error: "You don't have permission to remove this share" },
        { status: 403 }
      );
    }

    // Delete share
    await prisma.fileShare.delete({
      where: { id },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        userId: decoded.userId,
        fileId: existingShare.fileId,
        action: "FILE_UNSHARED",
      },
    });

    return NextResponse.json(
      {
        message: "Share removed successfully",
        fileId: existingShare.fileId,
        fileTitle: existingShare.file.title,
        sharedWithUser: existingShare.sharedWith.username,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete share error:", error);
    return NextResponse.json(
      { error: "Failed to remove share" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
