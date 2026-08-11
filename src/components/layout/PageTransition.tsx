// src/components/layout/PageTransition.tsx

import { type ReactNode, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  const variants = useMemo(
    () => ({
      initial: { opacity: 0, y: prefersReducedMotion ? 0 : 8 },
      animate: { opacity: 1, y: 0 }
    }),
    [prefersReducedMotion]
  );

  const transition = useMemo(
    () => ({
      duration: prefersReducedMotion ? 0 : 0.25,
      ease: [0.16, 1, 0.3, 1] as const
    }),
    [prefersReducedMotion]
  );

  return (
    <motion.div key={location.pathname} initial="initial" animate="animate" variants={variants} transition={transition}>
      {children}
    </motion.div>
  );
}
