import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// GET /api/files/recent - Get recent files for authenticated user
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get recent files (owned by user or shared with user)
    const ownedFiles = await prisma.file.findMany({
      where: {
        ownerId: decoded.userId,
        trash: {
          none: {
            userId: decoded.userId,
          },
        },
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
        owner: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Get shared files
    const sharedFiles = await prisma.file.findMany({
      where: {
        shares: {
          some: {
            sharedWithId: decoded.userId,
          },
        },
        trash: {
          none: {},
        },
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
        owner: {
          select: {
            id: true,
            username: true,
            name: true,
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
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Combine and sort by updated date
    const allFiles = [...ownedFiles, ...sharedFiles]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);

    // Define a type for the file object to avoid 'any'
    type FileWithRelations = (typeof ownedFiles)[number] & {
      shares?: { permission: string }[];
    };

    // Transform files
    const transformedFiles = allFiles.map((file: FileWithRelations) => ({
      id: file.id,
      title: file.title,
      content: file.content,
      isFavorite: file.favourites.length > 0,
      isTrashed: file.trash.length > 0,
      isShared: file.ownerId !== decoded.userId,
      permission:
        file.ownerId === decoded.userId
          ? "OWNER"
          : file.shares?.[0]?.permission || "VIEW",
      owner: {
        id: file.owner.id,
        username: file.owner.username,
        name: file.owner.name,
      },
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      userId: file.ownerId,
    }));

    // Get total count for pagination
    const totalOwned = await prisma.file.count({
      where: {
        ownerId: decoded.userId,
        trash: {
          none: {
            userId: decoded.userId,
          },
        },
      },
    });

    const totalShared = await prisma.file.count({
      where: {
        shares: {
          some: {
            sharedWithId: decoded.userId,
          },
        },
        trash: {
          none: {},
        },
      },
    });

    const total = totalOwned + totalShared;

    return NextResponse.json(
      {
        files: transformedFiles,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get recent files error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent files" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
