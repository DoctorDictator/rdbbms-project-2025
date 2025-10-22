import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// GET /api/favourites/[id] - Get a specific favourite by favourite ID (not file ID)
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

    // Get favourite with file details
    const favourite = await prisma.favourite.findUnique({
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
            trash: {
              where: {
                userId: decoded.userId,
              },
            },
            shares: {
              where: {
                sharedWithId: decoded.userId,
              },
              select: {
                permission: true,
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

    if (!favourite) {
      return NextResponse.json(
        { error: "Favourite not found" },
        { status: 404 }
      );
    }

    // Check if user owns this favourite
    if (favourite.userId !== decoded.userId) {
      return NextResponse.json(
        { error: "You don't have permission to view this favourite" },
        { status: 403 }
      );
    }

    // Transform response
    const transformedFavourite = {
      id: favourite.id,
      fileId: favourite.fileId,
      userId: favourite.userId,
      createdAt: favourite.createdAt.toISOString(),
      user: favourite.user,
      file: {
        id: favourite.file.id,
        title: favourite.file.title,
        content: favourite.file.content,
        isFavorite: true, // Always true since this is a favourite
        isTrashed: favourite.file.trash.length > 0,
        isShared: favourite.file.ownerId !== decoded.userId,
        permission:
          favourite.file.ownerId === decoded.userId
            ? "OWNER"
            : favourite.file.shares[0]?.permission || "VIEW",
        owner: favourite.file.owner,
        createdAt: favourite.file.createdAt.toISOString(),
        updatedAt: favourite.file.updatedAt.toISOString(),
      },
    };

    return NextResponse.json(
      { favourite: transformedFavourite },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get favourite error:", error);
    return NextResponse.json(
      { error: "Failed to fetch favourite" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/favourites/[id] - Remove a specific favourite by favourite ID
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

    // Check if favourite exists and belongs to user
    const favourite = await prisma.favourite.findUnique({
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

    if (!favourite) {
      return NextResponse.json(
        { error: "Favourite not found" },
        { status: 404 }
      );
    }

    if (favourite.userId !== decoded.userId) {
      return NextResponse.json(
        { error: "You don't have permission to delete this favourite" },
        { status: 403 }
      );
    }

    // Delete favourite
    await prisma.favourite.delete({
      where: { id },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        userId: decoded.userId,
        fileId: favourite.fileId,
        action: "FILE_UNFAVOURITED",
      },
    });

    return NextResponse.json(
      {
        message: "Removed from favourites successfully",
        fileId: favourite.fileId,
        fileTitle: favourite.file.title,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Remove favourite error:", error);
    return NextResponse.json(
      { error: "Failed to remove from favourites" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/favourites/[id] - Update favourite metadata (for future features)
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

    // Check if favourite exists and belongs to user
    const favourite = await prisma.favourite.findUnique({
      where: { id },
    });

    if (!favourite) {
      return NextResponse.json(
        { error: "Favourite not found" },
        { status: 404 }
      );
    }

    if (favourite.userId !== decoded.userId) {
      return NextResponse.json(
        { error: "You don't have permission to update this favourite" },
        { status: 403 }
      );
    }

    // Currently, favourites don't have any updatable fields
    // This endpoint is reserved for future features like tags, notes, etc.

    return NextResponse.json(
      {
        message: "Favourite metadata updated successfully",
        favourite: {
          id: favourite.id,
          fileId: favourite.fileId,
          userId: favourite.userId,
          createdAt: favourite.createdAt.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update favourite error:", error);
    return NextResponse.json(
      { error: "Failed to update favourite" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
