"use client";

import { useTheme } from "@/context/theme-context";

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-switch" role="group" aria-label="Tema">
      <button
        type="button"
        className={theme === "dark" ? "on" : ""}
        onClick={() => setTheme("dark")}
      >
        Dark
      </button>
      <button
        type="button"
        className={theme === "light" ? "on" : ""}
        onClick={() => setTheme("light")}
      >
        White
      </button>
    </div>
  );
}
