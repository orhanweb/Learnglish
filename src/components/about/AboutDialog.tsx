// src/components/about/AboutDialog.tsx

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Badge } from '@/components/ui';
import { Dialog } from '@/components/ui/dialog';
import { AboutContent } from './AboutContent';
import { ArrowDown, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { aboutIntro } from '@/content/about';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const [canClose, setCanClose] = useState(false);

  // Check if user has scrolled to the bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Tolerance of 10px for cross-browser float precision
    if (scrollHeight - scrollTop - clientHeight < 10) {
      setCanClose(true);
    }
  };

  // Reset state when dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && canClose) {
      onClose();
      // Small delay to reset state after animation closes
      setTimeout(() => setCanClose(false), 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} preventClose={!canClose} hideCloseButton>
      {/* Custom Header */}
      <div className="mb-4 flex items-center justify-between">
        <Badge variant="secondary" className="w-fit text-base bg-transparent border-l-2 border-l-primary rounded-none">
          {aboutIntro.badge}
        </Badge>

        {/* Close button only visible when canClose is true */}
        <AnimatePresence>
          {canClose && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                className="rounded-full text-muted-foreground hover:bg-muted"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AboutContent variant="dialog" onScroll={handleScroll} hideBadge />

      <AnimatePresence mode="wait">
        {canClose ? (
          <motion.div
            key="actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="mt-6 flex flex-row gap-2 sm:justify-between"
          >
            <Link to="/about" onClick={onClose} className="flex-1 sm:flex-none">
              <Button variant="secondary" className="w-full sm:w-auto">
                View full About page
              </Button>
            </Link>
            <Button variant="secondary" className="flex-1 sm:flex-none" onClick={onClose}>
              Close
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="scroll-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="mt-6 flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"
          >
            <span>Slide to end for close</span>
            <ArrowDown className="h-4 w-4 animate-bounce" />
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
