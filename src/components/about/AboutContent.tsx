// src/components/about/AboutContent.tsx

import React from 'react';
import { Brain, Sparkles, Target, ExternalLink, Mail } from 'lucide-react';
import { Badge, Card, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { aboutIntro, aboutPillars, aboutAuthor, aboutLinks } from '@/content/about';

const toneStyles: Record<'primary' | 'success' | 'warning', { container: string; icon: string }> = {
  primary: { container: 'bg-primary/10 text-primary', icon: 'text-primary' },
  success: { container: 'bg-success/10 text-success', icon: 'text-success' },
  warning: { container: 'bg-warning/10 text-warning', icon: 'text-warning' }
};

const toneIcons = {
  primary: Brain,
  success: Sparkles,
  warning: Target
};

interface AboutContentProps {
  variant?: 'page' | 'dialog';
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  hideBadge?: boolean;
}

export function AboutContent({ variant = 'page', onScroll, hideBadge = false }: AboutContentProps) {
  const isDialog = variant === 'dialog';

  return (
    <div className={cn('space-y-8', isDialog && 'max-h-[60vh] overflow-y-auto pr-2')} onScroll={onScroll}>
      <div className="space-y-2">
        {!hideBadge && (
          <Badge variant="secondary" className="w-fit text-base bg-transparent border-l-2 border-l-primary rounded-none">
            {aboutIntro.badge}
          </Badge>
        )}
        <h1 className={cn('font-bold', isDialog ? 'text-2xl' : 'text-3xl')}>{aboutIntro.title}</h1>
        <p className="text-muted-foreground">{aboutIntro.description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {aboutPillars.map(pillar => {
          const Icon = toneIcons[pillar.tone];
          const tone = toneStyles[pillar.tone];
          return (
            <Card key={pillar.title} className="p-5 space-y-2">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', tone.container)}>
                <Icon className={cn('h-5 w-5', tone.icon)} />
              </div>
              <h2 className="text-lg font-semibold">{pillar.title}</h2>
              <p className="text-sm text-muted-foreground">{pillar.description}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="text-2xl font-semibold">{aboutAuthor.title}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {aboutAuthor.description.split('Orhan Kahraman').map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <span className="bg-linear-to-r from-teal-500 to-orange-500 text-white px-1 py-0.5 rounded-md cursor-default">Orhan Kahraman</span>
              )}
            </span>
          ))}
        </p>

        <div className="space-y-1">
          <p className="font-medium">{aboutAuthor.contactHeading}</p>
          <p className="text-muted-foreground">{aboutAuthor.contactDescription}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {aboutLinks.map(link => (
            <a key={link.label} href={link.href} target={link.type === 'external' ? '_blank' : undefined} rel="noreferrer">
              <Button variant="outline" className="gap-2">
                {link.label}
                {link.type === 'email' ? <Mail className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
              </Button>
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
