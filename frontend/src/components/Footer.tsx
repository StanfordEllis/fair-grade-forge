import { GraduationCap } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-card/80 border-t border-border/50 mt-auto backdrop-blur-sm">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div className="text-sm text-muted-foreground">
              © 2024 Fair Grade Forge. Fair evaluation through encryption.
            </div>
          </div>
          
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors font-medium">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors font-medium">Terms</a>
            <a href="#" className="hover:text-primary transition-colors font-medium">Support</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

