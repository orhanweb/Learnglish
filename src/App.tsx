// src/App.tsx

import { Outlet } from 'react-router-dom';
import { AppInitProvider, Layout, PageTransition, ThemeProvider } from '@/components/layout';

export default function App() {
  return (
    <AppInitProvider>
      <ThemeProvider>
        <Layout>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </Layout>
      </ThemeProvider>
    </AppInitProvider>
  );
}
