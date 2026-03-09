import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "ftrepo_session";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const NO_STORE_CACHE_CONTROL = "no-store, no-cache, must-revalidate";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const derivedBuffer = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuffer, derivedBuffer);
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await prisma.session.create({
    data: { token, userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  return token;
}

function expireSessionCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>
) {
  try {
    cookieStore.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  } catch {
    // Cookie writes are not always allowed in every server context.
  }
}

export function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": NO_STORE_CACHE_CONTROL };
}

export function jsonNoStore(
  body: Parameters<typeof NextResponse.json>[0],
  init?: Parameters<typeof NextResponse.json>[1]
) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", NO_STORE_CACHE_CONTROL);

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export async function validateSession(
  token: string,
  options?: {
    clearInvalidCookie?: boolean;
    cookieStore?: Awaited<ReturnType<typeof cookies>>;
  }
) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    if (options?.clearInvalidCookie && options.cookieStore) {
      expireSessionCookie(options.cookieStore);
    }
    return null;
  }
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    if (options?.clearInvalidCookie && options.cookieStore) {
      expireSessionCookie(options.cookieStore);
    }
    return null;
  }

  return session.user;
}

export async function getCurrentUser(options?: { clearInvalidCookie?: boolean }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return validateSession(token, {
    clearInvalidCookie: options?.clearInvalidCookie,
    cookieStore,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

type User = { id: number; username: string; role: string; approved: boolean };

export function withAuth(
  handler: (req: Request, user: User) => Promise<NextResponse>
) {
  return async (req: Request) => {
    const user = await getCurrentUser({ clearInvalidCookie: true });
    if (!user) {
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.approved) {
      return jsonNoStore({ error: "Account pending approval" }, { status: 403 });
    }
    return handler(req, user);
  };
}

export function withAdmin(
  handler: (req: Request, user: User) => Promise<NextResponse>
) {
  return async (req: Request) => {
    const user = await getCurrentUser({ clearInvalidCookie: true });
    if (!user) {
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.approved) {
      return jsonNoStore({ error: "Account pending approval" }, { status: 403 });
    }
    if (user.role !== "admin") {
      return jsonNoStore({ error: "Admin access required" }, { status: 403 });
    }
    return handler(req, user);
  };
}
