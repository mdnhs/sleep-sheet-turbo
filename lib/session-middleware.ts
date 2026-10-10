
import { createMiddleware } from 'hono/factory'
import { getCookie, deleteCookie } from 'hono/cookie'

import jwt from 'jsonwebtoken'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { AUTH_COOKIE } from '@/features/auth/constants'
import { authenticateApiKey } from '@/lib/api-keys'
import { authenticateOAuthToken } from '@/lib/oauth'


type SessionUser = {
  id: string
  email: string
  name: string
  role: string
  permissions: string[]
  landingUrl?: string | null
  phone: string | null
  address: string | null
}

// Every authenticated API request used to run a users lookup (plus its role
// join) before the route handler even started — a dashboard page load fires
// several requests, so that was several extra database round trips per page,
// each one waking the serverless compute. The resolved session user is cached
// in-process for a short window instead.
//
// TTL is deliberately short: a role or permission change takes effect within
// SESSION_CACHE_TTL_MS everywhere, and immediately on the instance that made
// the change (it calls invalidateSessionUser). The cache is per-instance, so
// it never has to be correct across instances for longer than that window.
const SESSION_CACHE_TTL_MS = 30_000
const sessionCache = new Map<string, { user: SessionUser; expiresAt: number }>()

/** Drop a user's cached session — call after changing their role/permissions. */
export function invalidateSessionUser(userId: string) {
  sessionCache.delete(userId)
}

/** Drop every cached session — call after editing a role many users share. */
export function invalidateAllSessions() {
  sessionCache.clear()
}

type CustomContext = {
  Variables: {
    db: typeof db
    user: {
      id: string
      email: string
      name: string
      role: string
      permissions: string[]
      landingUrl?: string | null
      phone: string | null
      address: string | null
    } | null
  }
}

export const sessionMiddleware = createMiddleware<CustomContext>(async (c, next) => {
  c.set('db', db)

  // Server-to-server callers send an API key or an OAuth access token
  // instead of a browser session cookie. Checked first — a request with an
  // Authorization header never has a real login cookie anyway, and an
  // invalid credential should fail as "logged out", not silently fall
  // through to the cookie check below.
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7).trim()
    const bearerUser = rawToken.startsWith('mcp_at_')
      ? await authenticateOAuthToken(rawToken)
      : await authenticateApiKey(rawToken)
    c.set('user', bearerUser)
    return await next()
  }

  const token = getCookie(c, AUTH_COOKIE)

  if (!token) {
    c.set('user', null)
    return await next()
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string
      email: string
    }

    const cached = sessionCache.get(decoded.id)
    if (cached && cached.expiresAt > Date.now()) {
      c.set('user', cached.user)
      return await next()
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.id),
      with: { assignedRole: true },
    })

    if (!user) {
      sessionCache.delete(decoded.id)
      c.set('user', null)
      deleteCookie(c, AUTH_COOKIE, { path: "/" })
      return await next()
    }

    const isSuperAdmin = user.email === process.env.SUPER_ADMIN_EMAIL;

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: isSuperAdmin ? 'ADMIN' : user.role,
      permissions: user.assignedRole ? user.assignedRole.permissions : [],
      landingUrl: user.assignedRole ? user.assignedRole.landingUrl : null,
      phone: user.phone,
      address: user.address
    }

    sessionCache.set(user.id, { user: sessionUser, expiresAt: Date.now() + SESSION_CACHE_TTL_MS })
    c.set('user', sessionUser)
  } catch (err) {
    console.error('Invalid token', err)
    c.set('user', null)
    deleteCookie(c, AUTH_COOKIE, { path: "/" })
  }

  await next()
})
