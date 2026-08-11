// src/routes.tsx

/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Link } from 'react-router-dom';
import App from '@/App';
import { Button } from '@/components/ui';

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">The page you’re looking for doesn’t exist or was moved.</p>
      <Link to="/">
        <Button>Back to home</Button>
      </Link>
    </div>
  );
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        {
          index: true,
          lazy: async () => {
            const { HomePage } = await import('@/pages/HomePage');
            return { Component: HomePage };
          }
        },
        {
          path: 'level/:level',
          lazy: async () => {
            const { LevelPage } = await import('@/pages/LevelPage');
            return { Component: LevelPage };
          }
        },
        {
          path: 'level/:level/part/:partNumber',
          lazy: async () => {
            const { PartPage } = await import('@/pages/PartPage');
            return { Component: PartPage };
          }
        },
        {
          path: 'word/:id',
          lazy: async () => {
            const { WordPage } = await import('@/pages/WordPage');
            return { Component: WordPage };
          }
        },
        {
          path: 'quiz/:level/:partNumber',
          lazy: async () => {
            const { QuizPage } = await import('@/pages/QuizPage');
            return { Component: QuizPage };
          }
        },
        {
          path: 'review',
          lazy: async () => {
            const { ReviewPage } = await import('@/pages/ReviewPage');
            return { Component: ReviewPage };
          }
        },
        {
          path: 'review/:level',
          lazy: async () => {
            const { ReviewLevelPage } = await import('@/pages/ReviewLevelPage');
            return { Component: ReviewLevelPage };
          }
        },
        {
          path: 'review/quiz',
          lazy: async () => {
            const { ReviewQuizPage } = await import('@/pages/ReviewQuizPage');
            return { Component: ReviewQuizPage };
          }
        },
        {
          path: 'review/:level/quiz',
          lazy: async () => {
            const { ReviewQuizPage } = await import('@/pages/ReviewQuizPage');
            return { Component: ReviewQuizPage };
          }
        },
        {
          path: 'about',
          lazy: async () => {
            const { AboutPage } = await import('@/pages/AboutPage');
            return { Component: AboutPage };
          }
        },
        {
          path: 'stats',
          lazy: async () => {
            const { StatsPage } = await import('@/pages/StatsPage');
            return { Component: StatsPage };
          }
        },
        {
          path: 'settings',
          lazy: async () => {
            const { SettingsPage } = await import('@/pages/SettingsPage');
            return { Component: SettingsPage };
          }
        },
        { path: '*', element: <NotFoundPage /> }
      ]
    }
  ],
  {
    basename: import.meta.env.BASE_URL
  }
);
