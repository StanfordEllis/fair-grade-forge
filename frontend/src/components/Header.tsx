import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

export const Header = () => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Fair Grade Forge</h1>
              <p className="text-xs text-muted-foreground">Fair Evaluation Through Encryption</p>
            </div>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Student
            </Link>
            <Link to="/teacher" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Teacher
            </Link>
            <ConnectButton />
          </nav>
          
          <div className="md:hidden">
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
};

