import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const KEY = "adaptlearn.theme";
const ThemeContext = createContext(null);

function systemPrefersDark() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => {
    try {
      return localStorage.getItem(KEY) || "system";
    } catch {
      return "system";
    }
  });
  const dark = preference === "dark" || (preference === "system" && systemPrefersDark());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggle = useCallback(() => {
    const next = dark ? "light" : "dark";
    setPreference(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage can be unavailable (private mode); the theme still applies for this session */
    }
  }, [dark]);

  const value = useMemo(() => ({ dark, toggle }), [dark, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
