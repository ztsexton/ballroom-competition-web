import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { ThemeKey, themes } from '../themes';

const STORAGE_KEY = 'app-theme';
const DEFAULT_THEME: ThemeKey = 'indigo';

interface ThemeContextType {
  theme: ThemeKey;
  setTheme: (key: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

function applyTheme(key: ThemeKey) {
  const colors = themes[key]?.colors;
  if (!colors) return;
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(colors)) {
    root.style.setProperty(prop, value);
  }
}

function readStoredTheme(): ThemeKey {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in themes) return stored as ThemeKey;
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_THEME;
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeKey>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((key: ThemeKey) => {
    setThemeState(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
