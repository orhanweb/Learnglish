// src/components/layout/Layout.tsx

import { useState, type ReactNode } from 'react';
import { AboutDialog } from '@/components/about';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [showAboutDialog, setShowAboutDialog] = useState(() => {
    try {
      const seen = window.localStorage.getItem('learnglish-about-seen');
      return !seen;
    } catch {
      return true;
    }
  });

  const handleClose = () => {
    setShowAboutDialog(false);
    try {
      window.localStorage.setItem('learnglish-about-seen', 'true');
    } catch {
      // ignore storage errors
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">{children}</div>
      </main>
      <AboutDialog open={showAboutDialog} onClose={handleClose} />
    </div>
  );
}
