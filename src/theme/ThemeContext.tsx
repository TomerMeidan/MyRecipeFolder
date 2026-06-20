import React, { createContext, useContext, useState, useEffect } from 'react';
import { getStoredTheme, setStoredTheme } from '../utils/themeStorage';

export interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryLight: string;
  border: string;
  shadow: string;
  warningBox: string;
  warningText: string;
  errorBox: string;
  errorText: string;
}

export type ColorSchemeType = 'default' | 'blue' | 'black' | 'white';

interface ThemeContextProps {
  theme: ThemeColors;
  isDarkMode: boolean;
  colorScheme: ColorSchemeType;
  toggleDarkMode: () => void;
  setColorScheme: (scheme: ColorSchemeType) => void;
}

const getThemeColors = (isDark: boolean, scheme: ColorSchemeType): ThemeColors => {
  let primary = '#E05C2D';
  let primaryLight = '#FFF0EB';
  
  if (scheme === 'blue') {
    primary = '#2563EB';
    primaryLight = '#EFF6FF';
  } else if (scheme === 'black') {
    primary = isDark ? '#FFFFFF' : '#0F172A';
    primaryLight = isDark ? '#334155' : '#F1F5F9';
  } else if (scheme === 'white') {
    primary = isDark ? '#E2E8F0' : '#475569';
    primaryLight = isDark ? '#1E293B' : '#F8FAFC';
  }

  if (isDark) {
    let background = '#121212';
    let card = '#1E1E1E';
    let border = '#2E2E2E';
    
    if (scheme === 'blue') {
      background = '#0F172A';
      card = '#1E293B';
      border = '#334155';
    } else if (scheme === 'black') {
      background = '#000000';
      card = '#121212';
      border = '#262626';
    } else if (scheme === 'white') {
      background = '#0F172A';
      card = '#1E293B';
      border = '#334155';
    }

    return {
      background,
      card,
      text: '#F8FAFC',
      textSecondary: '#94A3B8',
      primary,
      primaryLight: scheme === 'default' ? '#3B1E16' : primaryLight,
      border,
      shadow: '#000000',
      warningBox: '#2E2514',
      warningText: '#F59E0B',
      errorBox: '#3B1B1B',
      errorText: '#EF4444',
    };
  } else {
    let background = '#F5F5F5';
    let card = '#FFFFFF';
    let border = '#E8E8E8';

    if (scheme === 'blue') {
      background = '#F0F4F8';
      card = '#FFFFFF';
      border = '#E2E8F0';
    } else if (scheme === 'black') {
      background = '#FAFAFA';
      card = '#FFFFFF';
      border = '#E5E5E5';
    } else if (scheme === 'white') {
      background = '#F8FAFC';
      card = '#FFFFFF';
      border = '#E2E8F0';
    }

    return {
      background,
      card,
      text: '#1E293B',
      textSecondary: '#64748B',
      primary,
      primaryLight,
      border,
      shadow: 'rgba(0, 0, 0, 0.05)',
      warningBox: '#FFF8E1',
      warningText: '#795548',
      errorBox: '#FFEBEE',
      errorText: '#C62828',
    };
  }
};

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [colorScheme, setInternalColorScheme] = useState<ColorSchemeType>('default');

  useEffect(() => {
    getStoredTheme().then((prefs) => {
      if (!prefs) return;
      setIsDarkMode(prefs.isDarkMode);
      setInternalColorScheme(prefs.colorScheme);
    });
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      setStoredTheme({ isDarkMode: next, colorScheme });
      return next;
    });
  };

  const setColorScheme = (scheme: ColorSchemeType) => {
    setInternalColorScheme(scheme);
    setStoredTheme({ isDarkMode, colorScheme: scheme });
  };

  const theme = getThemeColors(isDarkMode, colorScheme);

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, colorScheme, toggleDarkMode, setColorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextProps => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
