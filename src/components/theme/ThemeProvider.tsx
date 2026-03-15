"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored && ["light", "dark", "system"].includes(stored)) {
      setTheme(stored);
    }
    setMounted(true);
  }, []);

  // Resolve theme based on system preference
  useEffect(() => {
    const root = document.documentElement;
    
    const resolveTheme = () => {
      if (theme === "system") {
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        return systemPrefersDark ? "dark" : "light";
      }
      return theme;
    };

    const newResolvedTheme = resolveTheme();
    setResolvedTheme(newResolvedTheme);

    // Update data-theme attribute
    root.setAttribute("data-theme", newResolvedTheme);

    // Update localStorage
    localStorage.setItem("theme", theme);

    // Update Tailwind dark mode class
    if (newResolvedTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = () => {
      const newResolvedTheme = mediaQuery.matches ? "dark" : "light";
      setResolvedTheme(newResolvedTheme);
      document.documentElement.setAttribute("data-theme", newResolvedTheme);
      
      if (newResolvedTheme === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Prevent flash of incorrect theme
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Theme toggle component
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div className="flex items-center gap-2 p-2 bg-white/5 dark:bg-black/20 rounded-lg">
      <button
        onClick={() => setTheme("light")}
        className={`px-3 py-1.5 text-sm rounded-md transition-all ${
          theme === "light"
            ? "bg-blue-500 text-white"
            : "text-gray-600 dark:text-gray-400 hover:bg-white/10"
        }`}
        aria-label="Light mode"
      >
        ☀️
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`px-3 py-1.5 text-sm rounded-md transition-all ${
          theme === "dark"
            ? "bg-purple-600 text-white"
            : "text-gray-600 dark:text-gray-400 hover:bg-white/10"
        }`}
        aria-label="Dark mode"
      >
        🌙
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`px-3 py-1.5 text-sm rounded-md transition-all ${
          theme === "system"
            ? "bg-gray-600 text-white"
            : "text-gray-600 dark:text-gray-400 hover:bg-white/10"
        }`}
        aria-label="System theme"
      >
        ⚙️
      </button>
      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
        {resolvedTheme === "dark" ? "Dark" : "Light"}
      </span>
    </div>
  );
}