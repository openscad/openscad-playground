// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React from 'react';
import { Button } from 'primereact/button';
import { ModelContext } from './contexts';

export default function ThemeToggle() {
  const model = React.useContext(ModelContext);
  if (!model || !model.state || !model.state.view) return null; // Don't render if model/state not available

  const isDark = (model.state.view as any).theme === 'dark' || true; // Default to dark for now

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    model.mutate(state => {
      state.view.theme = newTheme;
    });
  };

  return (
    <Button
      icon={isDark ? 'pi pi-sun' : 'pi pi-moon'}
      onClick={toggleTheme}
      rounded
      text
      severity="secondary"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
        color: isDark ? '#fff' : '#333',
        transition: 'all 0.3s ease'
      }}
      className="theme-toggle-button"
    />
  );
}
