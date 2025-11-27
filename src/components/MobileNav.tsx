"use client";

import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils"; // Assuming cn is available for conditional class names

const MobileNav: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Saved Posts", path: "/saved-posts" }, // New link
    { name: "Roadmap", path: "/roadmap" },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[250px] sm:w-[300px]">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold text-gray-800 dark:text-gray-200">Navigation</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-4 mt-8">
          {navLinks.map((link) => (
            <NavLink
              key={link.name}
              to={link.path}
              className={({ isActive }) =>
                cn(
                  "text-lg font-medium transition-colors hover:text-blue-500 dark:hover:text-blue-300",
                  isActive
                    ? "text-blue-600 dark:text-blue-400" // Changed for better active contrast
                    : "text-gray-600 dark:text-gray-300"
                )
              }
              onClick={() => setIsOpen(false)} // Close sheet on navigation
            >
              {link.name}
            </NavLink>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;