import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import type { Prisma, SharePermission } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// GET /api/shares/by-me - Get all shares created by the authenticated user
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
    const permission = searchParams.get("permission");
    const searchQuery = searchParams.get("search") || "";

    // Build where clause
    const whereClause: Prisma.FileShareWhereInput = {
      ownerId: decoded.userId,
    };

    if (permission && ["VIEW", "EDIT"].includes(permission)) {
      whereClause.permission = permission as SharePermission;
    }

    // If a search query is provided, add filters
    if (searchQuery) {
      whereClause.OR = [
        {
          file: {
            title: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
        },
        {
          sharedWith: {
            username: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
        },
        {
          sharedWith: {
            name: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    // Get all shares created by user
    const shares = await prisma.fileShare.findMany({
      where: whereClause,
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
        sharedWith: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Transform response
    const transformedShares = shares.map((share) => ({
      shareId: share.id,
      permission: share.permission,
      sharedAt: share.createdAt.toISOString(),
      sharedWith: share.sharedWith,
      file: {
        id: share.file.id,
        title: share.file.title,
        content: share.file.content,
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
        ownerId: decoded.userId,
        permission: "VIEW",
      },
    });

    const editCount = await prisma.fileShare.count({
      where: {
        ownerId: decoded.userId,
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
    console.error("Get shares by me error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shares" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
