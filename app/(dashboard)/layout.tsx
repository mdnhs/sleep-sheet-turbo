import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeaderActions } from "@/components/dashboard-header-actions";
import { PageTitleSlot } from "@/components/dashboard-page-title";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import React from "react";
import { BottomNav } from "@/components/bottom-nav";

interface DashBoardLayoutProps {
  children: React.ReactNode;
}

function DashBoardLayout({ children }: DashBoardLayoutProps) {
  return (
    // Moved here from the root layout, which no longer loads tooltips for
    // every storefront page; the sidebar's tooltips keep their shared provider.
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-[#F6F6F4] dark:bg-background">
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 bg-white/95 dark:bg-card/95 backdrop-blur-md px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-14">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            {/* The current page's title and description (<PageTitle> in each page). */}
            <PageTitleSlot />
            <DashboardHeaderActions />
          </header>
          <main className="flex-1 min-w-0 bg-[#F6F6F4] dark:bg-background pb-20 md:pb-0">{children}</main>
          <BottomNav />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default DashBoardLayout;
