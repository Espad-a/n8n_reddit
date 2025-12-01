"use client";

import React from "react";
import { Link } from "react-router-dom";
import MobileNav from "./MobileNav";
import AICountdown from "./AICountdown";
import ThemeToggle from "./ThemeToggle"; // Import the new ThemeToggle component

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center px-4 sm:px-6 lg:px-8">
        <MobileNav />
        <div className="mr-4 hidden md:flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <img src="/light-logo.png" alt="ApexX Logo" className="h-8 w-auto" /> {/* Increased logo size */}
            {/* Removed the ApexX span */}
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link to="/" className="transition-colors hover:text-primary">
              Home
            </Link>
            <Link to="/saved-posts" className="transition-colors hover:text-primary"> {/* New link */}
              Saved Posts
            </Link>
            <Link to="/saved-roadmaps" className="transition-colors hover:text-primary"> {/* New link */}
              Saved Roadmaps
            </Link>
            <Link to="/saved-comments" className="transition-colors hover:text-primary"> {/* New link */}
              Saved Comments
            </Link>
            <Link to="/roadmap" className="transition-colors hover:text-primary">
              Roadmap
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <AICountdown />
          <ThemeToggle /> {/* Add the ThemeToggle component here */}
        </div>
      </div>
    </header>
  );
};

export default Header;