import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// POST /api/trash/empty - Empty entire trash (permanently delete all trashed files)
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

    // Get all trashed files for the user
    const trashedFiles = await prisma.trash.findMany({
      where: {
        userId: decoded.userId,
      },
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

    if (trashedFiles.length === 0) {
      return NextResponse.json(
        {
          message: "Trash is already empty",
          deletedCount: 0,
        },
        { status: 200 }
      );
    }

    // Only delete files that the user owns
    const fileIdsToDelete = trashedFiles
      .filter((t) => t.file.ownerId === decoded.userId)
      .map((t) => t.fileId);

    let deletedCount = 0;

    if (fileIdsToDelete.length > 0) {
      // Delete all related data first (in transaction)
      await prisma.$transaction(async (tx) => {
        // Delete favourites
        await tx.favourite.deleteMany({
          where: {
            fileId: {
              in: fileIdsToDelete,
            },
          },
        });

        // Delete shares
        await tx.fileShare.deleteMany({
          where: {
            fileId: {
              in: fileIdsToDelete,
            },
          },
        });

        // Delete activities (optional - you might want to keep activity history)
        await tx.activity.deleteMany({
          where: {
            fileId: {
              in: fileIdsToDelete,
            },
          },
        });

        // Delete trash entries
        await tx.trash.deleteMany({
          where: {
            fileId: {
              in: fileIdsToDelete,
            },
          },
        });

        // Finally, delete the files themselves
        const result = await tx.file.deleteMany({
          where: {
            id: {
              in: fileIdsToDelete,
            },
            ownerId: decoded.userId,
          },
        });

        deletedCount = result.count;
      });

      // Create activity log for emptying trash
      await prisma.activity.create({
        data: {
          userId: decoded.userId,
          fileId: null,
          action: "FILE_DELETED",
        },
      });
    }

    // Count files that couldn't be deleted (not owned by user)
    const skippedCount = trashedFiles.length - deletedCount;

    return NextResponse.json(
      {
        message: `Successfully emptied trash. ${deletedCount} file(s) permanently deleted.${
          skippedCount > 0
            ? ` ${skippedCount} file(s) skipped (not owned by you).`
            : ""
        }`,
        deletedCount,
        skippedCount,
        totalProcessed: trashedFiles.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Empty trash error:", error);
    return NextResponse.json(
      { error: "Failed to empty trash" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/trash/empty - Alternative method (same as POST)
export async function DELETE(request: NextRequest) {
  // Reuse POST logic
  return POST(request);
}

// GET /api/trash/empty - Get trash statistics
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

    // Get all trashed files for the user
    const trashedFiles = await prisma.trash.findMany({
      where: {
        userId: decoded.userId,
      },
      include: {
        file: {
          select: {
            id: true,
            title: true,
            ownerId: true,
            content: true,
          },
        },
      },
    });

    // Count files that can be deleted (owned by user)
    const deletableFiles = trashedFiles.filter(
      (t) => t.file.ownerId === decoded.userId
    );

    // Calculate storage size (approximate - based on content length)
    const totalSize = deletableFiles.reduce(
      (sum, t) => sum + (t.file.content?.length || 0),
      0
    );

    // Format size
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    // Get oldest and newest trash dates
    const sortedByDate = [...trashedFiles].sort(
      (a, b) => a.deletedAt.getTime() - b.deletedAt.getTime()
    );

    const oldestDate =
      sortedByDate.length > 0 ? sortedByDate[0].deletedAt : null;
    const newestDate =
      sortedByDate.length > 0
        ? sortedByDate[sortedByDate.length - 1].deletedAt
        : null;

    return NextResponse.json(
      {
        totalTrashed: trashedFiles.length,
        deletableFiles: deletableFiles.length,
        nonDeletableFiles: trashedFiles.length - deletableFiles.length,
        approximateSize: formatSize(totalSize),
        approximateSizeBytes: totalSize,
        oldestTrashedAt: oldestDate ? oldestDate.toISOString() : null,
        newestTrashedAt: newestDate ? newestDate.toISOString() : null,
        isEmpty: trashedFiles.length === 0,
        canEmpty: deletableFiles.length > 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get trash stats error:", error);
    return NextResponse.json(
      { error: "Failed to get trash statistics" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
