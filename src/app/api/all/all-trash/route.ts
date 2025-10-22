import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/all/all-trash - Get all trashed files in the database
export async function GET(request: NextRequest) {
  try {
    const trashedFiles = await prisma.trash.findMany({
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
      },
      orderBy: { deletedAt: "asc" },
    });

    // Transform files to include isFavorite (always false) and isTrashed (always true)
    const files = trashedFiles
      .filter((trash) => trash.file && trash.file.owner)
      .map((trash) => ({
        id: trash.file.id,
        title: trash.file.title,
        content: trash.file.content,
        isFavorite: false,
        isTrashed: true,
        createdAt: trash.file.createdAt.toISOString(),
        updatedAt: trash.file.updatedAt.toISOString(),
        deletedAt: trash.deletedAt.toISOString(),
        userId: trash.file.ownerId,
        trashId: trash.id,
        owner: trash.file.owner,
      }));

    return NextResponse.json({ files }, { status: 200 });
  } catch (error) {
    console.error("Get all trash error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trashed files" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
