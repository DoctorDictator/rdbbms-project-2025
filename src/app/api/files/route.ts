import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// GET /api/files - Get all files for authenticated user
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

    // Get all files owned by user
    const files = await prisma.file.findMany({
      where: {
        ownerId: decoded.userId,
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
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Transform files to include isFavorite and isTrashed flags
    const transformedFiles = files.map((file) => ({
      id: file.id,
      title: file.title,
      content: file.content,
      isFavorite: file.favourites.length > 0,
      isTrashed: file.trash.length > 0,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      userId: file.ownerId,
    }));

    return NextResponse.json({ files: transformedFiles }, { status: 200 });
  } catch (error) {
    console.error("Get files error:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/files - Create a new file
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
    const { title, content } = body;

    // Validate input
    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    if (title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 }
      );
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        { error: "Content cannot be empty" },
        { status: 400 }
      );
    }

    // Create file
    const file = await prisma.file.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        ownerId: decoded.userId,
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        userId: decoded.userId,
        fileId: file.id,
        action: "FILE_CREATED",
      },
    });

    return NextResponse.json(
      {
        message: "File created successfully",
        file: {
          id: file.id,
          title: file.title,
          content: file.content,
          isFavorite: false,
          isTrashed: false,
          createdAt: file.createdAt.toISOString(),
          updatedAt: file.updatedAt.toISOString(),
          userId: file.ownerId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create file error:", error);
    return NextResponse.json(
      { error: "Failed to create file" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
