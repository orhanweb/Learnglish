// src/components/word/SynonymLinks.tsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui';
import { db } from '@/lib/db';

interface SynonymLinksProps {
  synonymIds: string[];
}

interface SynonymLabel {
  id: string;
  label: string;
}

export function SynonymLinks({ synonymIds }: SynonymLinksProps) {
  const [labels, setLabels] = useState<SynonymLabel[]>([]);

  useEffect(() => {
    if (synonymIds.length === 0) return;
    let cancelled = false;
    void (async () => {
      // Single batched fetch; falls back to the id when a synonym entry is missing.
      const rows = await db.words.bulkGet(synonymIds);
      if (cancelled) return;
      const next: SynonymLabel[] = synonymIds.map((id, index) => {
        const row = rows[index];
        const label = row?.wordEn[0] ?? id;
        return { id, label };
      });
      setLabels(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [synonymIds]);

  if (synonymIds.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Synonyms:</span>
      {labels.map(({ id, label }) => (
        <Link key={id} to={`/word/${id}`}>
          <Badge variant="outline" className="cursor-pointer gap-1 transition-colors hover:bg-accent">
            {label}
            <ExternalLink className="h-3 w-3" />
          </Badge>
        </Link>
      ))}
    </div>
  );
}
