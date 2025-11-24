"use client";

import React from "react";
import { Link } from "react-router-dom";
import MobileNav from "./MobileNav";

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center px-4 sm:px-6 lg:px-8">
        <MobileNav />
        <div className="mr-4 hidden md:flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold text-xl">Dyad App</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link to="/" className="transition-colors hover:text-primary">
              Home
            </Link>
            <Link to="/roadmap" className="transition-colors hover:text-primary">
              Roadmap
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          {/* Future elements like user profile, theme toggle can go here */}
        </div>
      </div>
    </header>
  );
};

export default Header;