// src/content/about.ts

export const aboutIntro = {
  badge: 'About',
  title: 'Why Learnglish exists',
  description:
    'Learnglish is built to make vocabulary practice deliberate, consistent, and motivating. It blends active recall and spaced repetition to help you retain words faster with less effort.'
};

export const aboutPillars = [
  {
    title: 'Active Recall',
    description: 'You answer before seeing the solution, strengthening memory pathways.',
    tone: 'primary' as const
  },
  {
    title: 'Spaced Repetition',
    description: 'Review timing adapts to what you remember so you improve efficiently.',
    tone: 'success' as const
  },
  {
    title: 'Context Learning',
    description: 'Real sentences build intuition and make vocabulary feel natural.',
    tone: 'warning' as const
  }
];

export const aboutAuthor = {
  title: 'Who built this?',
  description: 'Built by Orhan Kahraman. I design learning tools that feel simple, intentional, and delightful to use.',
  contactHeading: 'Suggestions & improvements?',
  contactDescription: 'Reach me via the channels below. I read every message and love collaborating on better learning experiences.'
};

export const aboutLinks = [
  {
    label: 'GitHub',
    href: 'https://github.com/orhanweb',
    type: 'external' as const
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/orhan-kahraman/',
    type: 'external' as const
  },
  {
    label: 'orhan.stack@gmail.com',
    href: 'mailto:orhan.stack@gmail.com',
    type: 'email' as const
  }
];
