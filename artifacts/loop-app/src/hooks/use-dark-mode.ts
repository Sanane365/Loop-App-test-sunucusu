import { useState, useEffect } from "react";

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
    try {
      localStorage.setItem("loop-dark", String(dark));
    } catch {}
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}
