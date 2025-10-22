import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// GET /api/favourites - Get all favourite files for authenticated user
export async function GET(request: NextRequest) {
  try {
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

    // Get all favourite files
    const favourites = await prisma.favourite.findMany({
      where: {
        userId: decoded.userId,
      },
      include: {
        file: {
          include: {
            trash: {
              where: {
                userId: decoded.userId,
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
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform files to include isFavorite (always true) and isTrashed flags
    const transformedFiles = favourites.map((fav) => ({
      id: fav.file.id,
      title: fav.file.title,
      content: fav.file.content,
      isFavorite: true, // Always true since these are favourites
      isTrashed: fav.file.trash.length > 0,
      createdAt: fav.file.createdAt.toISOString(),
      updatedAt: fav.file.updatedAt.toISOString(),
      userId: fav.file.ownerId,
      favouritedAt: fav.createdAt.toISOString(), // When it was added to favourites
      favouriteId: fav.id, // Include favourite ID for direct deletion
      owner: fav.file.owner,
    }));

    return NextResponse.json(
      {
        files: transformedFiles,
        total: transformedFiles.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get favourites error:", error);
    return NextResponse.json(
      { error: "Failed to fetch favourite files" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/favourites - Add a file to favourites
export async function POST(request: NextRequest) {
  try {
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
    const { fileId } = body;

    // Validate input
    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    // Check if file exists
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check if user has access to this file (owner or shared with)
    if (file.ownerId !== decoded.userId) {
      const share = await prisma.fileShare.findUnique({
        where: {
          fileId_sharedWithId: {
            fileId: fileId,
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

    // Check if already favourited
    const existingFavourite = await prisma.favourite.findUnique({
      where: {
        userId_fileId: {
          userId: decoded.userId,
          fileId: fileId,
        },
      },
    });

    if (existingFavourite) {
      return NextResponse.json(
        {
          message: "File is already in favourites",
          favourite: {
            id: existingFavourite.id,
            fileId: existingFavourite.fileId,
            userId: existingFavourite.userId,
            createdAt: existingFavourite.createdAt.toISOString(),
          },
          isFavorite: true,
        },
        { status: 200 }
      );
    }

    // Add to favourites
    const favourite = await prisma.favourite.create({
      data: {
        userId: decoded.userId,
        fileId: fileId,
      },
      include: {
        file: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
            trash: {
              where: {
                userId: decoded.userId,
              },
            },
          },
        },
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        userId: decoded.userId,
        fileId: fileId,
        action: "FILE_FAVOURITED",
      },
    });

    // Transform response
    const transformedFavourite = {
      id: favourite.id,
      fileId: favourite.fileId,
      userId: favourite.userId,
      createdAt: favourite.createdAt.toISOString(),
      file: {
        id: favourite.file.id,
        title: favourite.file.title,
        content: favourite.file.content,
        isFavorite: true,
        isTrashed: favourite.file.trash.length > 0,
        createdAt: favourite.file.createdAt.toISOString(),
        updatedAt: favourite.file.updatedAt.toISOString(),
        owner: favourite.file.owner,
      },
    };

    return NextResponse.json(
      {
        message: "File added to favourites successfully",
        favourite: transformedFavourite,
        isFavorite: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Add to favourites error:", error);
    return NextResponse.json(
      { error: "Failed to add file to favourites" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/favourites - Remove all favourites (bulk delete)
export async function DELETE(request: NextRequest) {
  try {
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

    // Get body for optional file IDs to delete
    let fileIds: string[] = [];

    try {
      const body = await request.json();
      fileIds = body.fileIds || [];
    } catch {
      // If no body, delete all favourites
      fileIds = [];
    }

    let deletedCount: number;

    if (fileIds.length > 0) {
      // Delete specific favourites
      const result = await prisma.favourite.deleteMany({
        where: {
          userId: decoded.userId,
          fileId: {
            in: fileIds,
          },
        },
      });
      deletedCount = result.count;

      // Create activities for each unfavourited file
      await Promise.all(
        fileIds.map((fileId) =>
          prisma.activity.create({
            data: {
              userId: decoded.userId,
              fileId: fileId,
              action: "FILE_UNFAVOURITED",
            },
          })
        )
      );
    } else {
      // Delete all favourites for user
      const result = await prisma.favourite.deleteMany({
        where: {
          userId: decoded.userId,
        },
      });
      deletedCount = result.count;

      // Create bulk activity
      await prisma.activity.create({
        data: {
          userId: decoded.userId,
          fileId: null,
          action: "FILE_UNFAVOURITED",
        },
      });
    }

    return NextResponse.json(
      {
        message: `Successfully removed ${deletedCount} file(s) from favourites`,
        deletedCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Remove favourites error:", error);
    return NextResponse.json(
      { error: "Failed to remove favourites" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
