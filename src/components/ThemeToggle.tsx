// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React from 'react';
import { Button } from 'primereact/button';
import { ModelContext } from './contexts';

export default function ThemeToggle() {
  const model = React.useContext(ModelContext);
  if (!model?.state?.view) return null; // Don't render if model/state not available

  const isDark = (model.state.view as any).theme === 'dark';

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    model.mutate(state => {
      state.view.theme = newTheme;
    });

    // Save theme preference to localStorage
    if (typeof localStorage !== 'undefined') {
      if (newTheme === 'light') {
        localStorage.setItem('theme', 'light');
      } else {
        localStorage.removeItem('theme'); // Default is dark, so remove any saved preference
      }
    }
  };

  return (
    <Button
      icon={isDark ? 'pi pi-sun' : 'pi pi-moon'}
      onClick={toggleTheme}
      rounded
      severity="secondary"
      aria-label={`Switch to ${isDark ? 'dark' : 'light'} mode`}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
        border: `2px solid ${isDark ? '#ffffff' : '#333333'}`,
        color: isDark ? '#fff' : '#333',
        transition: 'all 0.3s ease',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
      }}
    />
  );
}
