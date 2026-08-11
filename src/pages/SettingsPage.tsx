// src/pages/SettingsPage.tsx

import { Moon, Sun, Monitor, RefreshCw } from 'lucide-react';
import { Button, Card, Switch, LoadingState } from '@/components/ui';
import { useSettingsStore } from '@/stores';
import { useTheme } from '@/components/layout';
import { cn } from '@/lib/utils';
import type { Theme, QuizMode } from '@/types';
import { LearningDataCard } from '@/components/settings/LearningDataCard';

export function SettingsPage() {
  const {
    hasHydrated,
    quizMode,
    shuffleQuizOrder,
    tolerateTypos,
    showTranslationsAlways,
    setQuizMode,
    setShuffleQuizOrder,
    setTolerateTypos,
    setShowTranslationsAlways,
    resetSettings
  } = useSettingsStore();

  const { theme, setTheme } = useTheme();

  const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor }
  ];

  const quizModeOptions: { value: QuizMode; label: string; description: string }[] = [
    {
      value: 'recognition',
      label: 'Recognition (EN → TR)',
      description: 'See English, type Turkish'
    },
    {
      value: 'production',
      label: 'Production (TR → EN)',
      description: 'See Turkish, type English'
    },
    {
      value: 'mixed',
      label: 'Mixed',
      description: 'Random direction for each word'
    }
  ];

  if (!hasHydrated) {
    return <LoadingState messages={['Loading settings...']} />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Customize your learning experience</p>
      </div>

      {/* Theme */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Appearance</h2>
        <div className="flex gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <Button key={value} variant={theme === value ? 'default' : 'outline'} onClick={() => setTheme(value)} className="flex-1 gap-2">
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Quiz Settings */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Quiz Settings</h2>

        {/* Quiz Mode */}
        <div className="space-y-3">
          <label className="text-sm text-muted-foreground">Default Quiz Mode</label>
          <div className="grid gap-2">
            {quizModeOptions.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => setQuizMode(value)}
                className={cn(
                  'flex flex-col items-start rounded-lg border p-3 text-left transition-colors',
                  quizMode === value ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                )}
              >
                <span className="font-medium">{label}</span>
                <span className="text-sm text-muted-foreground">{description}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Features */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Features</h2>

        <SettingRow
          label="Shuffle Quiz Order"
          description="Randomize word order in quizzes"
          checked={shuffleQuizOrder}
          onCheckedChange={setShuffleQuizOrder}
        />

        <SettingRow
          label="Tolerate Typos"
          description="Accept answers with minor spelling mistakes"
          checked={tolerateTypos}
          onCheckedChange={setTolerateTypos}
        />

        <SettingRow
          label="Show Translations Always"
          description="Always show Turkish translations for example sentences"
          checked={showTranslationsAlways}
          onCheckedChange={setShowTranslationsAlways}
        />
      </Card>

      <LearningDataCard />

      {/* Reset */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Reset Settings</h2>
            <p className="text-sm text-muted-foreground">Restore all settings to their defaults</p>
          </div>
          <Button variant="outline" onClick={resetSettings} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </Card>
    </div>
  );
}

interface SettingRowProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: React.ReactNode;
}

function SettingRow({ label, description, checked, onCheckedChange, icon }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
