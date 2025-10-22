import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/all/all-shared - Get all shared files in the database
export async function GET(request: NextRequest) {
  try {
    const shares = await prisma.fileShare.findMany({
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
      orderBy: { createdAt: "asc" },
    });

    // Map to shape expected by frontend
    const shared = shares
      .filter((share) => share.file && share.owner && share.sharedWith)
      .map((share) => ({
        shareId: share.id,
        permission: share.permission,
        sharedAt: share.createdAt.toISOString(),
        file: {
          id: share.file.id,
          title: share.file.title,
          content: share.file.content,
          createdAt: share.file.createdAt.toISOString(),
          updatedAt: share.file.updatedAt.toISOString(),
          owner: share.file.owner,
        },
        owner: share.owner,
        sharedWith: share.sharedWith,
      }));

    return NextResponse.json({ shared }, { status: 200 });
  } catch (error) {
    console.error("Get all shared error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shared files" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
