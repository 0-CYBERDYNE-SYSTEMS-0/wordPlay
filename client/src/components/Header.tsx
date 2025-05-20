import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sun, Moon, Menu, Info, Plus } from "lucide-react";

interface HeaderProps {
  toggleSidebar: () => void;
  toggleContextPanel: () => void;
  onNewProject: () => void;
}

export default function Header({ toggleSidebar, toggleContextPanel, onNewProject }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <header className="border-b dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 5.523-4.477 10-10 10S0 15.523 0 10 4.477 0 10 0s10 4.477 10 10z" />
              <path d="M13 7l4 -4" />
              <path d="M13 7h-6a2 2 0 0 0 -2 2v6" />
              <path d="M17 17v-6a2 2 0 0 0 -2 -2h-6" />
            </svg>
            <h1 className="text-xl font-semibold">WritingCompanion AI</h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button 
            variant="outline" 
            size="sm"
            className="flex items-center space-x-1"
            onClick={onNewProject}
          >
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </Button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleContextPanel} aria-label="Toggle context panel">
                  <Info className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Context Panel</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
                  {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle {theme === "light" ? "Dark" : "Light"} Mode</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <div className="flex items-center space-x-1 ml-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
              <span className="text-sm font-medium">U</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
