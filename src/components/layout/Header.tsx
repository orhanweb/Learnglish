import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, BarChart3, Settings, Moon, Sun, RefreshCw, Info, Menu, X } from 'lucide-react';
import { Button, Logo } from '@/components/ui';
import { useTheme } from './useTheme';
import { useProgressStore } from '@/stores';
import { cn } from '@/lib/utils';
import { useScrollLock } from '@/hooks';
import { AnimatePresence, motion } from 'framer-motion';

const navItems = [
  { path: '/', label: 'Learn', icon: BookOpen },
  { path: '/review', label: 'Review', icon: RefreshCw },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
  { path: '/about', label: 'About', icon: Info },
  { path: '/settings', label: 'Settings', icon: Settings }
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { resolvedTheme, setTheme, theme } = useTheme();
  const { dueWordsCount } = useProgressStore();

  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    } else {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  // Prevent scrolling when menu is open
  useScrollLock(isOpen);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
          <Logo />
          <span className="text-xl font-bold tracking-tight">Learnglish</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            const showBadge = path === '/review' && dueWordsCount > 0;

            return (
              <Link key={path} to={path}>
                <Button variant={isActive ? 'secondary' : 'ghost'} size="sm" className={cn('relative gap-2', isActive && 'bg-secondary')}>
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                  {showBadge && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {dueWordsCount > 99 ? '99+' : dueWordsCount}
                    </span>
                  )}
                </Button>
              </Link>
            );
          })}

          {/* Theme toggle */}
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} className="ml-2">
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </nav>

        {/* Mobile Menu Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme}>
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle Menu">
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: '100dvh' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed left-0 top-16 z-40 w-full overflow-hidden bg-background/95 md:hidden"
          >
            <nav className="container flex flex-col gap-4 p-8">
              {navItems.map(({ path, label, icon: Icon }, index) => {
                const isActive = location.pathname === path;
                const showBadge = path === '/review' && dueWordsCount > 0;

                return (
                  <motion.div
                    key={path}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                  >
                    <Link to={path} onClick={() => setIsOpen(false)}>
                      <Button
                        variant={isActive ? 'secondary' : 'ghost'}
                        className={cn('w-full justify-start gap-4 py-6 text-lg font-medium', isActive && 'bg-secondary')}
                      >
                        <Icon className="h-6 w-6" />
                        {label}
                        {showBadge && (
                          <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                            {dueWordsCount > 99 ? '99+' : dueWordsCount}
                          </span>
                        )}
                      </Button>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
