import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/all/all-activities - Get all activities in the database

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const full = searchParams.get("full") === "true";

    // If no limit is specified, fetch all activities
    let limit: number | undefined = undefined;
    let offset: number | undefined = undefined;

    if (searchParams.has("limit")) {
      limit = parseInt(searchParams.get("limit") || "100");
    }
    if (searchParams.has("offset")) {
      offset = parseInt(searchParams.get("offset") || "0");
    }

    const activities = await prisma.activity.findMany({
      include: full
        ? {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                email: true,
              },
            },
            file: {
              select: {
                id: true,
                title: true,
                content: true,
              },
            },
          }
        : {
            file: {
              select: {
                id: true,
                title: true,
              },
            },
          },
      orderBy: { createdAt: "asc" }, // ascending order
      ...(limit !== undefined ? { take: limit } : {}),
      ...(offset !== undefined ? { skip: offset } : {}),
    });

    const totalCount = await prisma.activity.count();

    return NextResponse.json(
      {
        activities,
        total: totalCount,
        pagination: {
          limit: limit ?? null,
          offset: offset ?? null,
          hasMore:
            offset !== undefined && limit !== undefined
              ? offset + limit < totalCount
              : false,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get all activities error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
