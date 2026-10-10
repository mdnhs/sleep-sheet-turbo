"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useResetUserPassword } from "@/features/users/api/use-reset-user-password";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

// Admin-side password reset — since self-service forgot-password (OTP) was
// removed, this is now the only way for a locked-out or forgetful user to
// get back in. Only visible to staff with MANAGE_USERS.
export function ResetPasswordDialog({ open, onOpenChange, userId, userName }: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const resetPassword = useResetUserPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetPassword.mutate(
      { id: userId, newPassword },
      {
        onSuccess: () => {
          onOpenChange(false);
          setNewPassword("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setNewPassword(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for <span className="font-semibold text-foreground">{userName}</span>. They&apos;ll need to sign in with it directly — there&apos;s no email notification, so share it with them yourself.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <Input
              type="password"
              placeholder="Min. 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
