"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "kayzen-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const resolved: Theme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    setTheme(resolved);
    document.documentElement.dataset.theme = resolved;
    setMounted(true);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      aria-label={theme === "dark" ? "Activer le mode clair" : "Activer le mode sombre"}
      aria-pressed={theme === "dark"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/30 bg-white/12 text-slate-100 transition hover:bg-white/20 hover:text-white"
      onClick={toggleTheme}
      type="button"
    >
      {mounted ? (
        theme === "dark" ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />
      ) : (
        <Moon aria-hidden="true" size={16} />
      )}
    </button>
  );
}
