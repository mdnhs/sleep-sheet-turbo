import { can, isAllowed } from "@/lib/permissions";

/**
 * Who may read store-wide analytics.
 *
 * Every handler in features/analytics used to check only "is anyone logged
 * in". Signup is public and self-serve, and a new account gets role USER with
 * no permissions — so any of the store's registered customers could call those
 * endpoints and read revenue, customer lifetime value, cohort retention,
 * spending segments, stock levels and the most recent orders with the
 * customers' names on them. Every other dashboard route in the app already
 * gated on a permission; that one was simply missed.
 *
 * Accepts `reports:read` as well as `dashboard:read` on purpose. The two are
 * separate modules, and a role can legitimately carry either: the store's own
 * "Owner" role holds reports:read without dashboard:read, and requiring only
 * the latter would have locked it out of the dashboard it is named for.
 * ADMIN passes via can(); MODERATOR is bypassed the same way the orders
 * routes bypass it.
 *
 * Shared by features/analytics and features/web-analytics.
 */
export function canViewAnalytics(user: Parameters<typeof can>[0]): boolean {
  return isAllowed(user, "dashboard", "read", ["MODERATOR"]) || can(user, "reports", "read");
}
