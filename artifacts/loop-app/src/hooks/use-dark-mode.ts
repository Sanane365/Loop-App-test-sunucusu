import { useState, useEffect } from "react";
import { applySystemColor, getSystemColorId } from "./use-system-color";

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("loop-dark") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    applySystemColor(getSystemColorId());
    try {
      localStorage.setItem("loop-dark", String(dark));
    } catch {}
    window.dispatchEvent(new Event("loop-dark-mode-change"));
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}
