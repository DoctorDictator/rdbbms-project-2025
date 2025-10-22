import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// GET /api/trash - Get all trashed files for authenticated user
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

    // Get all trashed files
    const trashedFiles = await prisma.trash.findMany({
      where: {
        userId: decoded.userId,
      },
      include: {
        file: {
          include: {
            favourites: {
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
        deletedAt: "desc",
      },
    });

    // Transform files to include isFavorite and isTrashed (always true) flags
    const transformedFiles = trashedFiles.map((trash) => ({
      id: trash.file.id,
      title: trash.file.title,
      content: trash.file.content,
      isFavorite: trash.file.favourites.length > 0,
      isTrashed: true, // Always true since these are in trash
      createdAt: trash.file.createdAt.toISOString(),
      updatedAt: trash.file.updatedAt.toISOString(),
      deletedAt: trash.deletedAt.toISOString(), // When it was moved to trash
      userId: trash.file.ownerId,
      trashId: trash.id, // Include trash ID for direct deletion
      owner: trash.file.owner,
    }));

    return NextResponse.json(
      {
        files: transformedFiles,
        total: transformedFiles.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get trash error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trashed files" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/trash - Move a file to trash
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

    // Check if user owns the file
    if (file.ownerId !== decoded.userId) {
      return NextResponse.json(
        { error: "You don't have permission to trash this file" },
        { status: 403 }
      );
    }

    // Check if already in trash
    const existingTrash = await prisma.trash.findUnique({
      where: {
        userId_fileId: {
          userId: decoded.userId,
          fileId: fileId,
        },
      },
    });

    if (existingTrash) {
      return NextResponse.json(
        {
          message: "File is already in trash",
          trash: {
            id: existingTrash.id,
            fileId: existingTrash.fileId,
            userId: existingTrash.userId,
            deletedAt: existingTrash.deletedAt.toISOString(),
          },
          isTrashed: true,
        },
        { status: 200 }
      );
    }

    // Move to trash
    const trash = await prisma.trash.create({
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
            favourites: {
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
        action: "FILE_TRASHED",
      },
    });

    // Transform response
    const transformedTrash = {
      id: trash.id,
      fileId: trash.fileId,
      userId: trash.userId,
      deletedAt: trash.deletedAt.toISOString(),
      file: {
        id: trash.file.id,
        title: trash.file.title,
        content: trash.file.content,
        isFavorite: trash.file.favourites.length > 0,
        isTrashed: true,
        createdAt: trash.file.createdAt.toISOString(),
        updatedAt: trash.file.updatedAt.toISOString(),
        owner: trash.file.owner,
      },
    };

    return NextResponse.json(
      {
        message: "File moved to trash successfully",
        trash: transformedTrash,
        isTrashed: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Move to trash error:", error);
    return NextResponse.json(
      { error: "Failed to move file to trash" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/trash - Empty trash or delete specific files from trash
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
    let emptyTrash = false;

    try {
      const body = await request.json();
      fileIds = body.fileIds || [];
      emptyTrash = body.emptyTrash || false;
    } catch {
      // If no body, do nothing
      return NextResponse.json(
        { error: "Please specify fileIds or emptyTrash: true" },
        { status: 400 }
      );
    }

    let deletedCount = 0;
    const restoredCount = 0;

    if (emptyTrash) {
      // Empty entire trash - permanently delete all files
      const trashedFiles = await prisma.trash.findMany({
        where: {
          userId: decoded.userId,
        },
        select: {
          fileId: true,
          file: {
            select: {
              ownerId: true,
            },
          },
        },
      });

      // Only delete files that the user owns
      const fileIdsToDelete = trashedFiles
        .filter((t) => t.file.ownerId === decoded.userId)
        .map((t) => t.fileId);

      if (fileIdsToDelete.length > 0) {
        // Delete files permanently (cascade will remove trash entries)
        await prisma.file.deleteMany({
          where: {
            id: {
              in: fileIdsToDelete,
            },
            ownerId: decoded.userId,
          },
        });

        deletedCount = fileIdsToDelete.length;

        // Create activity
        await prisma.activity.create({
          data: {
            userId: decoded.userId,
            fileId: null,
            action: "FILE_DELETED",
          },
        });
      }
    } else if (fileIds.length > 0) {
      // Delete specific files from trash permanently
      const trashedFiles = await prisma.trash.findMany({
        where: {
          userId: decoded.userId,
          fileId: {
            in: fileIds,
          },
        },
        select: {
          fileId: true,
          file: {
            select: {
              ownerId: true,
            },
          },
        },
      });

      // Only delete files that the user owns
      const fileIdsToDelete = trashedFiles
        .filter((t) => t.file.ownerId === decoded.userId)
        .map((t) => t.fileId);

      if (fileIdsToDelete.length > 0) {
        // Delete files permanently (cascade will remove trash entries)
        await prisma.file.deleteMany({
          where: {
            id: {
              in: fileIdsToDelete,
            },
            ownerId: decoded.userId,
          },
        });

        deletedCount = fileIdsToDelete.length;

        // Create activities for each deleted file
        await Promise.all(
          fileIdsToDelete.map((fileId) =>
            prisma.activity.create({
              data: {
                userId: decoded.userId,
                fileId: null,
                action: "FILE_DELETED",
              },
            })
          )
        );
      }
    } else {
      return NextResponse.json(
        { error: "Please specify fileIds or emptyTrash: true" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: emptyTrash
          ? `Successfully emptied trash (${deletedCount} file(s) permanently deleted)`
          : `Successfully deleted ${deletedCount} file(s) permanently from trash`,
        deletedCount,
        restoredCount,
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

// PATCH /api/trash - Restore files from trash (bulk restore)
export async function PATCH(request: NextRequest) {
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

    // Get body for file IDs to restore
    const body = await request.json();
    const { fileIds } = body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: "fileIds array is required" },
        { status: 400 }
      );
    }

    // Restore files from trash (remove from trash table)
    const result = await prisma.trash.deleteMany({
      where: {
        userId: decoded.userId,
        fileId: {
          in: fileIds,
        },
      },
    });

    const restoredCount = result.count;

    // Create activities for each restored file
    await Promise.all(
      fileIds.map((fileId) =>
        prisma.activity.create({
          data: {
            userId: decoded.userId,
            fileId: fileId,
            action: "FILE_RESTORED",
          },
        })
      )
    );

    return NextResponse.json(
      {
        message: `Successfully restored ${restoredCount} file(s) from trash`,
        restoredCount,
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
