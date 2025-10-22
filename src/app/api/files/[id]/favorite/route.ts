import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// PATCH /api/files/[id]/favorite - Toggle favorite status for a file
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

    // Check if file exists
    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check if user has access to this file (owner or shared with)
    if (file.ownerId !== decoded.userId) {
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
          { error: "You don't have access to this file" },
          { status: 403 }
        );
      }
    }

    // Check if already favorited
    const existingFavourite = await prisma.favourite.findUnique({
      where: {
        userId_fileId: {
          userId: decoded.userId,
          fileId: id,
        },
      },
    });

    let isFavorite: boolean;

    if (existingFavourite) {
      // Remove from favorites
      await prisma.favourite.delete({
        where: { id: existingFavourite.id },
      });

      // Create activity
      await prisma.activity.create({
        data: {
          userId: decoded.userId,
          fileId: id,
          action: "FILE_UNFAVOURITED",
        },
      });

      isFavorite = false;
    } else {
      // Add to favorites
      await prisma.favourite.create({
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
          action: "FILE_FAVOURITED",
        },
      });

      isFavorite = true;
    }

    return NextResponse.json(
      {
        message: isFavorite ? "Added to favorites" : "Removed from favorites",
        isFavorite,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Toggle favorite error:", error);
    return NextResponse.json(
      { error: "Failed to toggle favorite status" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
