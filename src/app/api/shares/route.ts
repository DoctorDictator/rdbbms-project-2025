import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// GET /api/shares/with-me - Get all files shared with the authenticated user
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

    // Get query parameters for pagination and filtering
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const permission = searchParams.get("permission"); // Optional filter by permission
    const searchQuery = searchParams.get("search") || ""; // Optional search

    // Build where clause
    const whereClause: Record<string, unknown> = {
      sharedWithId: decoded.userId,
    };

    if (permission && ["VIEW", "EDIT"].includes(permission)) {
      whereClause.permission = permission;
    }

    // If a search query is provided, add a relation filter on the related file
    if (searchQuery) {
      whereClause.file = {
        OR: [
          {
            title: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
          {
            content: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
        ],
      };
    }

    // Get all shares where user is the recipient
    const shares = await prisma.fileShare.findMany({
      where: whereClause,
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
            trash: {
              where: {
                userId: decoded.userId,
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Filter out shares where file doesn't match search (if file is null after include filter)
    const validShares = shares.filter((share) => share.file !== null);

    // Transform response to include file details
    const transformedShares = validShares.map((share) => ({
      shareId: share.id,
      permission: share.permission,
      sharedAt: share.createdAt.toISOString(),
      sharedBy: share.owner,
      file: {
        id: share.file.id,
        title: share.file.title,
        content: share.file.content,
        isFavorite: share.file.favourites.length > 0,
        isTrashed: share.file.trash.length > 0,
        isShared: true,
        canEdit: share.permission === "EDIT",
        owner: share.file.owner,
        createdAt: share.file.createdAt.toISOString(),
        updatedAt: share.file.updatedAt.toISOString(),
      },
    }));

    // Get total count for pagination
    const totalCount = await prisma.fileShare.count({
      where: whereClause,
    });

    // Get counts by permission
    const viewCount = await prisma.fileShare.count({
      where: {
        sharedWithId: decoded.userId,
        permission: "VIEW",
      },
    });

    const editCount = await prisma.fileShare.count({
      where: {
        sharedWithId: decoded.userId,
        permission: "EDIT",
      },
    });

    return NextResponse.json(
      {
        shares: transformedShares,
        total: totalCount,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
        stats: {
          total: totalCount,
          viewOnly: viewCount,
          canEdit: editCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get shared files error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shared files" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/shares/with-me - Mark all shares as viewed/acknowledged (optional feature)
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

    // Get body for optional actions
    const body = await request.json().catch(() => ({}));
    const { action, shareIds } = body;

    // Handle bulk actions
    if (action === "remove" && shareIds && Array.isArray(shareIds)) {
      // Remove multiple shares (user declining shares)
      const result = await prisma.fileShare.deleteMany({
        where: {
          id: {
            in: shareIds,
          },
          sharedWithId: decoded.userId, // Only allow removing shares where user is recipient
        },
      });

      return NextResponse.json(
        {
          message: `Successfully removed ${result.count} share(s)`,
          removedCount: result.count,
        },
        { status: 200 }
      );
    }

    if (action === "favorite" && shareIds && Array.isArray(shareIds)) {
      // Get file IDs from share IDs
      const shares = await prisma.fileShare.findMany({
        where: {
          id: {
            in: shareIds,
          },
          sharedWithId: decoded.userId,
        },
        select: {
          fileId: true,
        },
      });

      const fileIds = shares.map((s) => s.fileId);

      // Add files to favorites
      const favoritePromises = fileIds.map((fileId) =>
        prisma.favourite.upsert({
          where: {
            userId_fileId: {
              userId: decoded.userId,
              fileId: fileId,
            },
          },
          create: {
            userId: decoded.userId,
            fileId: fileId,
          },
          update: {},
        })
      );

      await Promise.all(favoritePromises);

      // Create activities
      const activityPromises = fileIds.map((fileId) =>
        prisma.activity.create({
          data: {
            userId: decoded.userId,
            fileId: fileId,
            action: "FILE_FAVOURITED",
          },
        })
      );

      await Promise.all(activityPromises);

      return NextResponse.json(
        {
          message: `Successfully added ${fileIds.length} shared file(s) to favorites`,
          favoritedCount: fileIds.length,
        },
        { status: 200 }
      );
    }

    // Default response if no action specified
    return NextResponse.json(
      {
        message: "No action specified",
        availableActions: ["remove", "favorite"],
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Shared files action error:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/shares/with-me - Remove all shares received by user (clear all)
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

    // Get body for optional selective deletion
    let shareIds: string[] = [];

    try {
      const body = await request.json();
      shareIds = body.shareIds || [];
    } catch {
      // If no body, will delete all
    }

    let result;

    if (shareIds.length > 0) {
      // Delete specific shares
      result = await prisma.fileShare.deleteMany({
        where: {
          id: {
            in: shareIds,
          },
          sharedWithId: decoded.userId,
        },
      });
    } else {
      // Delete all shares received by user
      result = await prisma.fileShare.deleteMany({
        where: {
          sharedWithId: decoded.userId,
        },
      });
    }

    // Create activity
    await prisma.activity.create({
      data: {
        userId: decoded.userId,
        fileId: null,
        action: "FILE_UNSHARED",
      },
    });

    return NextResponse.json(
      {
        message:
          shareIds.length > 0
            ? `Successfully removed ${result.count} share(s)`
            : `Successfully cleared all ${result.count} shared file(s)`,
        removedCount: result.count,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Remove shared files error:", error);
    return NextResponse.json(
      { error: "Failed to remove shares" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
