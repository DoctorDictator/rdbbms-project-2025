import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/profile/[id] - Get public profile by user id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    if (!userId)
      return NextResponse.json({ error: "User ID required" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/profile/[id] - Update user by id (admin only, not exposed in UI)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // You can implement admin-only update logic here if needed
  return NextResponse.json({ error: "Not allowed" }, { status: 403 });
}

// DELETE /api/profile/[id] - Delete user by id (admin only, not exposed in UI)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // You can implement admin-only delete logic here if needed
  return NextResponse.json({ error: "Not allowed" }, { status: 403 });
}
