import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const TOKEN_COOKIE = "vi_token";
const SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash. bcryptjs understands the $2y$ prefix that
 * PHP/Laravel produces, so existing seeded accounts log in unchanged.
 */
export async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: MAX_AGE });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}

/** Resolve the signed-in user (or null) from the request cookie. */
export async function getSessionUser() {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  return userFromToken(token);
}

/**
 * Resolve the signed-in user from a request — Bearer token (what the existing
 * frontend sends) first, then the session cookie.
 */
export async function userFromRequest(request) {
  const header = request.headers.get("authorization") || "";
  let token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) token = cookies().get(TOKEN_COOKIE)?.value;
  return userFromToken(token);
}

async function userFromToken(token) {
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.sub) return null;
  const user = await prisma.user.findUnique({ where: { id: Number(decoded.sub) } });
  if (!user || user.status === "suspended" || user.status === "inactive") return null;
  return user;
}

/** Shape a user for API responses (no password; matches the frontend's needs). */
export function publicUser(user, team = null) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    profile_picture: user.profilePicture,
    team: team ? { id: team.id, name: team.name, slug: team.slug } : null,
  };
}
