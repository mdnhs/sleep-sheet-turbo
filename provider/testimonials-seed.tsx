"use client";
import { useQueryClient } from "@tanstack/react-query";

// Seeds the ["testimonials", undefined] query cache — the key
// useGetTestimonials() reads with no params — from the same
// getPublicTestimonials() data already fetched server-side in
// app/(client)/layout.tsx. Without this, the Testimonials section on every
// storefront page (including /shop/[slug]) re-fetched data the server had
// already produced, on every page load. Mirrors SettingsSeed's pattern.
export function TestimonialsSeed({
  testimonials,
  children,
}: {
  testimonials: unknown;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  if (queryClient.getQueryData(["testimonials", undefined]) === undefined) {
    queryClient.setQueryData(["testimonials", undefined], testimonials);
  }
  return children;
}
