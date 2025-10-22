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

type JwtPayload = { userId: string };
type ShareRequestBody = {
  fileId?: string;
  identifier?: string;
  permission?: "VIEW" | "EDIT";
};
const PERMISSIONS = new Set<"VIEW" | "EDIT">(["VIEW", "EDIT"]);

/**
 * Try to pull a clean email or username out of any free-form identifier string.
 * Supports:
 *  - "harsh"
 *  - "harsh@example.com"
 *  - "Harsh <harsh@example.com>"
 *  - "harsh@example.com - note", "harsh (example) <harsh@example.com>"
 *  - "harsh some note" -> username = "harsh"
 */
function parseIdentifier(identifierRaw: string): {
  email?: string;
  username?: string;
} {
  const identifier = identifierRaw.trim();

  // Email regex: simple and permissive
  const emailMatch = identifier.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch) {
    return { email: emailMatch[0].toLowerCase() };
  }

  // Otherwise, take the first non-empty token as username (strip <>,"'- around it)
  const firstToken = identifier
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)[0];

  if (firstToken) {
    const username = firstToken.replace(/^[<"'(]+|[>"')]+$/g, "");
    return { username };
  }

  return {};
}

/**
 * POST /api/shares
 * Body: { fileId: string, identifier: string (username or email, can include notes), permission?: "VIEW" | "EDIT" }
 */
export async function POST(request: NextRequest) {
  try {
    // ---- Auth via cookie JWT ----
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as JwtPayload;
    const currentUserId = decoded.userId;
    // ---- Parse body ----
    const body = (await request
      .json()
      .catch(() => ({} as ShareRequestBody))) as ShareRequestBody;
    const { fileId, identifier, permission } = body;

    if (!fileId || !identifier) {
      return NextResponse.json(
        { error: "fileId and identifier are required" },
        { status: 400 }
      );
    }

    const perm: "VIEW" | "EDIT" = PERMISSIONS.has(permission)
      ? permission
      : "VIEW";

    // ---- Clean identifier to email or username ----
    const { email, username } = parseIdentifier(String(identifier));
    if (!email && !username) {
      return NextResponse.json(
        { error: "Provide a valid username or email to share with" },
        { status: 400 }
      );
    }

    // ---- Ensure file exists and you are the owner ----
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        owner: {
          select: { id: true, username: true, email: true, name: true },
        },
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    if (file.owner.id !== currentUserId) {
      return NextResponse.json(
        { error: "Not authorized to share this file" },
        { status: 403 }
      );
    }

    // ---- Find recipient by email or username (case-insensitive) ----
    const recipient = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email
            ? [{ email: { equals: email, mode: "insensitive" as const } }]
            : []),
          ...(username
            ? [{ username: { equals: username, mode: "insensitive" as const } }]
            : []),
        ],
      },
      select: { id: true, username: true, name: true, email: true },
    });

    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient not found. Check the username/email." },
        { status: 404 }
      );
    }

    if (recipient.id === currentUserId) {
      return NextResponse.json(
        { error: "You cannot share a file with yourself" },
        { status: 400 }
      );
    }

    // ---- If share exists, update permission; else create ----
    const existingShare = await prisma.fileShare.findFirst({
      where: {
        fileId: file.id,
        sharedWithId: recipient.id,
      },
      include: {
        owner: { select: { id: true, username: true, name: true } },
        file: {
          include: {
            owner: {
              select: { id: true, username: true, name: true, email: true },
            },
            favourites: { where: { userId: currentUserId } },
            trash: { where: { userId: currentUserId } },
          },
        },
      },
    });

    let share;
    if (existingShare) {
      // Update permission if changed
      if (existingShare.permission !== perm) {
        share = await prisma.fileShare.update({
          where: { id: existingShare.id },
          data: { permission: perm },
          include: {
            owner: { select: { id: true, username: true, name: true } },
            file: {
              include: {
                owner: {
                  select: { id: true, username: true, name: true, email: true },
                },
                favourites: { where: { userId: currentUserId } },
                trash: { where: { userId: currentUserId } },
              },
            },
          },
        });
      } else {
        share = existingShare;
      }
    } else {
      share = await prisma.fileShare.create({
        data: {
          fileId: file.id,
          ownerId: currentUserId,
          sharedWithId: recipient.id,
          permission: perm,
        },
        include: {
          owner: { select: { id: true, username: true, name: true } },
          file: {
            include: {
              owner: {
                select: { id: true, username: true, name: true, email: true },
              },
              favourites: { where: { userId: currentUserId } },
              trash: { where: { userId: currentUserId } },
            },
          },
        },
      });

      // Optional: create activity entry
      try {
        await prisma.activity.create({
          data: {
            userId: currentUserId,
            fileId: file.id,
            action: "FILE_SHARED",
          },
        });
      } catch {
        // Non-fatal
      }
    }

    // ---- Response shaped for your UI happiness ----
    const responsePayload = {
      shareId: share.id,
      permission: share.permission,
      sharedAt: share.createdAt.toISOString(),
      sharedBy: share.owner, // owner is the sharer (you)
      file: {
        id: share.file.id,
        title: share.file.title,
        content: share.file.content,
        isFavorite: share.file.favourites?.length > 0,
        isTrashed: share.file.trash?.length > 0,
        isShared: true,
        canEdit: share.permission === "EDIT",
        owner: share.file.owner,
        createdAt: share.file.createdAt.toISOString(),
        updatedAt: share.file.updatedAt.toISOString(),
      },
      // Additionally echo recipient for confirmations
      sharedWith: {
        id: recipient.id,
        username: recipient.username,
        name: recipient.name,
        email: recipient.email,
      },
      updated: !!existingShare,
    };

    return NextResponse.json(responsePayload, {
      status: existingShare ? 200 : 201,
    });
  } catch (err) {
    console.error("Create share error:", err);
    return NextResponse.json(
      { error: "Failed to share file" },
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
