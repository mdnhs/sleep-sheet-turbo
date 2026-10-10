"use client";

import Link from "next/link";
import { ExternalLink, User } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { useCurrent } from "@/features/auth/api/use-current";
import { UserButton } from "@/features/auth/components/user-button";

export function DashboardHeaderActions() {
  const { data: user } = useCurrent();

  return (
    <div className="ml-auto flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Visit frontend"
        nativeButton={false}
        render={<Link href="/" />}
      >
        <ExternalLink className="h-5 w-5" />
      </Button>
      <ModeToggle />
      {!user ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Account"
          nativeButton={false}
          render={<Link href="/signin" />}
        >
          <User className="h-5 w-5" />
        </Button>
      ) : (
        <UserButton />
      )}
    </div>
  );
}
