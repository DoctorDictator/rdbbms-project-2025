import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/all/all-favourites - Get all favourite files in the database
export async function GET(request: NextRequest) {
  try {
    // Fetch all favourites, include file->owner and the favouriting user
    const favourites = await prisma.favourite.findMany({
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
        user: {
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

    // Shape expected by frontend
    const files = favourites
      // only include rows where file and its owner exist
      .filter((fav) => fav.file && fav.file.owner)
      .map((fav) => {
        type FileWithOwner = typeof fav.file & {
          isTrashed?: boolean;
          ownerId?: string;
        };
        const file = fav.file as FileWithOwner;
        return {
          id: file.id,
          title: file.title,
          content: file.content,
          isFavorite: true,
          // if you don't track trash here, default to false
          isTrashed:
            typeof file.isTrashed === "boolean" ? file.isTrashed : false,
          createdAt: file.createdAt.toISOString(),
          updatedAt: file.updatedAt.toISOString(),
          // ownerId of the file
          userId: file.ownerId ?? undefined,
          favouritedAt: fav.createdAt.toISOString(),
          favouriteId: fav.id,
          owner: {
            id: file.owner!.id,
            username: file.owner!.username,
            name: file.owner!.name,
            email: file.owner!.email,
          },
          // optional: who favourited it (if you want this on the client)
          favouritedBy: fav.user
            ? {
                id: fav.user.id,
                username: fav.user.username,
                name: fav.user.name,
                email: fav.user.email,
              }
            : undefined,
        };
      });

    return NextResponse.json({ files }, { status: 200 });
  } catch (error) {
    console.error("Get all favourites error:", error);
    return NextResponse.json(
      { error: "Failed to fetch favourites" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
