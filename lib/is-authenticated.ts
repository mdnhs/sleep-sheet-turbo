// lib/auth.ts
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AUTH_COOKIE } from "@/features/auth/constants";

export async function getCurrentUser() {
  const cookieStore = cookies();
  const token = (await cookieStore).get(AUTH_COOKIE)?.value;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      email: string;
      role:string;
    };

    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.id),
      with: { assignedRole: true },
    });

    if (!user) return null;

    const isSuperAdmin = user.email === process.env.SUPER_ADMIN_EMAIL;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: isSuperAdmin ? "ADMIN" : user.role,
      permissions: user.assignedRole ? user.assignedRole.permissions : [],
      landingUrl: user.assignedRole ? user.assignedRole.landingUrl : null,
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}
