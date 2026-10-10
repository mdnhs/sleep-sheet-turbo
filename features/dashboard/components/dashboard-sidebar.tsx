"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ClipboardList,
  Globe,
  Home,
  Package,
  Plus,
  Receipt,
  Settings,
  Tags,
} from "lucide-react";
import Link from "next/link";

interface DashBoardSideBarProps {
  isOpen: boolean;
  onClose: () => void;
}

const SideBarItems = [
  { name: "DashBoard", href: "/dashboard", icon: <Home size={21} /> },
  {
    name: "Products Manager",
    href: "/dashboard/products",
    icon: <Package size={21} />,
  },
  {
    name: "Add New Product",
    href: "/dashboard/products/create",
    icon: <Plus size={21} />,
  },
  {
    name: "Categories Manager",
    href: "/dashboard/categories",
    icon: <Tags size={21} />,
  },
  {
    name: "Blog Manager",
    href: "/dashboard/blog",
    icon: <ClipboardList size={21} />,
  },
];

const OrderManagementItems = [
  {
    name: "All Orders",
    href: "/dashboard/orders",
    icon: <ClipboardList size={21} />,
  },
  {
    name: "Invoices",
    href: "/dashboard/orders/invoices",
    icon: <Receipt size={21} />,
  },
];

const SettingsItems = [
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: <Settings size={21} />,
  },
  {
    name: "Website Settings",
    href: "/dashboard/settings/website",
    icon: <Globe size={21} />,
  },
];

const DashBoardSideBar = ({ isOpen, onClose }: DashBoardSideBarProps) => {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="left"
        className="flex flex-col w-full sm:w-[400px] lg:w-[300px]"
      >
        <SheetHeader className="pb-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              LUXESTORE
            </SheetTitle>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <ul className="p-4">
            {SideBarItems.map((sideBarItem) => (
              <Link
                key={sideBarItem.name}
                href={sideBarItem.href}
                onClick={() => onClose()}
              >
                <li
                  key={sideBarItem.name}
                  className="flex flex-row items-center justify-between space-y-4"
                >
                  <h1 className=" text-md">{sideBarItem.name}</h1>
                  {sideBarItem.icon}
                </li>
              </Link>
            ))}
          </ul>
          <div className="px-4 pb-4">
            <label className="block border-t border-b py-4 text-sm font-medium text-muted-foreground">
              Settings
            </label>
            <ul className="mt-4 space-y-2">
              {SettingsItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => onClose()}
                >
                  <li className="flex flex-row items-center justify-between py-1.5">
                    <span className="text-md">{item.name}</span>
                    {item.icon}
                  </li>
                </Link>
              ))}
            </ul>
          </div>
          <div className="px-4 pb-4">
            <label className="block border-t border-b py-4 text-sm font-medium text-muted-foreground">
              Order&apos;s Management
            </label>
            <ul className="mt-4 space-y-2">
              {OrderManagementItems.map((orderManagement) => (
                <Link
                  key={orderManagement.name}
                  href={orderManagement.href}
                  onClick={() => onClose()}
                >
                  <li className="flex flex-row items-center justify-between py-1.5">
                    <span className="text-md">{orderManagement.name}</span>
                    {orderManagement.icon}
                  </li>
                </Link>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DashBoardSideBar;
