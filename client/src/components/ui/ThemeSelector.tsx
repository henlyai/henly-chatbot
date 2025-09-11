import React, { useContext, useCallback, useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { ThemeContext } from '~/hooks';

declare global {
  interface Window {
    lastThemeChange?: number;
  }
}

const Theme = ({ theme, onChange }: { theme: string; onChange: (value: string) => void }) => {
  const themeIcons = {
    system: <Monitor />,
    dark: <Moon color="white" />,
    light: <Sun />,
  };

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const label = `Switch to ${nextTheme} theme`;

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        onChange(nextTheme);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [nextTheme, onChange]);

  return (
    <button
      className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      aria-label={label}
      aria-keyshortcuts="Ctrl+Shift+T"
      onClick={(e) => {
        e.preventDefault();
        onChange(nextTheme);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChange(nextTheme);
        }
      }}
    >
      {themeIcons[theme]}
    </button>
  );
};

const ThemeSelector = ({ returnThemeOnly }: { returnThemeOnly?: boolean }) => {
  const { theme, setTheme } = useContext(ThemeContext);
  const [announcement, setAnnouncement] = useState('');

  const changeTheme = useCallback(
    (value: string) => {
      // Force light theme for Henly AI - ignore user input
      const forcedValue = 'light';
      
      const now = Date.now();
      if (typeof window.lastThemeChange === 'number' && now - window.lastThemeChange < 500) {
        return;
      }
      window.lastThemeChange = now;

      setTheme(forcedValue);
      setAnnouncement('Light theme enabled');
    },
    [setTheme],
  );

  useEffect(() => {
    // Force light theme on component mount
    if (theme !== 'light') {
      setTheme('light');
    }
  }, [theme, setTheme]);

  useEffect(() => {
    if (announcement) {
      const timeout = setTimeout(() => setAnnouncement(''), 1000);
      return () => clearTimeout(timeout);
    }
  }, [announcement]);

  if (returnThemeOnly === true) {
    return <Theme theme="light" onChange={changeTheme} />;
  }

  return (
    <div className="flex flex-col items-center justify-center bg-white pt-6 dark:bg-gray-900 sm:pt-0">
      <div className="absolute bottom-0 left-0 m-4">
        <Theme theme="light" onChange={changeTheme} />
      </div>
      {announcement && (
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
