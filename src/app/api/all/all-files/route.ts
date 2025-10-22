import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/all/all-files - Get all files in the database
export async function GET(request: NextRequest) {
  try {
    const files = await prisma.file.findMany({
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
      orderBy: { createdAt: "asc" },
    });

    const result = files.map((file) => ({
      id: file.id,
      title: file.title,
      content: file.content,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      ownerId: file.ownerId,
      owner: file.owner,
    }));

    return NextResponse.json({ files: result }, { status: 200 });
  } catch (error) {
    console.error("Get all files error:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
