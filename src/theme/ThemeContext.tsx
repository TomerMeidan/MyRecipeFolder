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
  /** Text/icon colour on a `primary` fill. */
  onPrimary: string;
  /** Marker fill behind what matters (quantities, step numbers); `text` reads on it. */
  highlight: string;
  /** Border for controls that must stay visible (checkboxes, outline buttons). */
  borderStrong: string;
}

export type ColorSchemeType = 'default' | 'blue' | 'black' | 'white' | 'kitchen' | 'green' | 'darkgreen';

// Kitchen Mode: arm's-length reading, high contrast, yellow highlighter.
const KITCHEN_LIGHT: ThemeColors = {
  background: '#FFFFFF', card: '#F3F3F0', text: '#111111', textSecondary: '#4A4A48',
  primary: '#111111', primaryLight: '#FFF6C2', onPrimary: '#FFFFFF',
  highlight: '#FFE45C', border: '#E2E2DE', borderStrong: '#8A8A86', shadow: 'rgba(0, 0, 0, 0.05)',
  warningBox: '#FFF8E1', warningText: '#795548', errorBox: '#FFEBEE', errorText: '#C62828',
};
const KITCHEN_DARK: ThemeColors = {
  background: '#0C0C0D', card: '#1B1B1D', text: '#F5F5F3', textSecondary: '#B5B5B0',
  primary: '#FFE45C', primaryLight: '#2E2A12', onPrimary: '#111111',
  highlight: '#5C5016', border: '#2C2C2F', borderStrong: '#6A6A66', shadow: '#000000',
  warningBox: '#2E2514', warningText: '#F59E0B', errorBox: '#3B1B1B', errorText: '#EF4444',
};

// Green: fresh herb green. Dark green: deep forest. Same status colours as Kitchen.
const STATUS_LIGHT = { warningBox: '#FFF8E1', warningText: '#795548', errorBox: '#FFEBEE', errorText: '#C62828' };
const STATUS_DARK = { warningBox: '#2E2514', warningText: '#F59E0B', errorBox: '#3B1B1B', errorText: '#EF4444' };
const GREEN_LIGHT: ThemeColors = {
  background: '#F4F8F5', card: '#FFFFFF', text: '#14261C', textSecondary: '#4D6155',
  primary: '#047857', primaryLight: '#DDF1E6', onPrimary: '#FFFFFF',
  highlight: '#C6F0D8', border: '#DCE7DF', borderStrong: '#6F8C7C', shadow: 'rgba(0, 0, 0, 0.05)', ...STATUS_LIGHT,
};
const GREEN_DARK: ThemeColors = {
  background: '#0E1712', card: '#17241C', text: '#EAF3ED', textSecondary: '#9DB3A6',
  primary: '#34D399', primaryLight: '#133626', onPrimary: '#052E1F',
  highlight: '#1F5A3D', border: '#25382C', borderStrong: '#5C7A69', shadow: '#000000', ...STATUS_DARK,
};
const DARKGREEN_LIGHT: ThemeColors = {
  background: '#F3F5F1', card: '#FFFFFF', text: '#16201A', textSecondary: '#4E5A52',
  primary: '#14532D', primaryLight: '#E2EDE5', onPrimary: '#FFFFFF',
  highlight: '#CFE3D4', border: '#DDE3DC', borderStrong: '#738276', shadow: 'rgba(0, 0, 0, 0.05)', ...STATUS_LIGHT,
};
const DARKGREEN_DARK: ThemeColors = {
  background: '#08110C', card: '#122019', text: '#E8F0EA', textSecondary: '#9FB2A5',
  primary: '#5FB383', primaryLight: '#173323', onPrimary: '#06200F',
  highlight: '#24543A', border: '#1F3328', borderStrong: '#57705F', shadow: '#000000', ...STATUS_DARK,
};

/** Full palettes; the older schemes are still derived in getThemeColors below. */
export const PALETTES: Partial<Record<ColorSchemeType, { light: ThemeColors; dark: ThemeColors }>> = {
  kitchen: { light: KITCHEN_LIGHT, dark: KITCHEN_DARK },
  green: { light: GREEN_LIGHT, dark: GREEN_DARK },
  darkgreen: { light: DARKGREEN_LIGHT, dark: DARKGREEN_DARK },
};

interface ThemeContextProps {
  theme: ThemeColors;
  isDarkMode: boolean;
  colorScheme: ColorSchemeType;
  toggleDarkMode: () => void;
  setColorScheme: (scheme: ColorSchemeType) => void;
}

const getThemeColors = (isDark: boolean, scheme: ColorSchemeType): ThemeColors => {
  const palette = PALETTES[scheme];
  if (palette) return isDark ? palette.dark : palette.light;

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

    const darkPrimaryLight = scheme === 'default' ? '#3B1E16' : primaryLight;
    return {
      background,
      card,
      text: '#F8FAFC',
      textSecondary: '#94A3B8',
      primary,
      primaryLight: darkPrimaryLight,
      // black/white dark schemes use a near-white primary, so text on it must be dark
      onPrimary: scheme === 'black' || scheme === 'white' ? '#0F172A' : '#FFFFFF',
      highlight: darkPrimaryLight,
      border,
      borderStrong: '#64748B',
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
      onPrimary: '#FFFFFF',
      highlight: primaryLight,
      border,
      borderStrong: '#94A3B8',
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
  const [colorScheme, setInternalColorScheme] = useState<ColorSchemeType>('kitchen');

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
