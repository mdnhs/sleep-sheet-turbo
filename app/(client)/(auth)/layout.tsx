import type { Metadata } from "next";
import React from "react";

// Sign-in/sign-up pages aren't search landing pages — keep them out of the index.
export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

interface AuthLayoutProps {
  children: React.ReactNode;
}

function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center -mt-20 bg-[#F4F4F4] dark:bg-gray-800">
      <div className="max-w-md w-full px-4">
        <div className="flex flex-col items-center justify-center space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
