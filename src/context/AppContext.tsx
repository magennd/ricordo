import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db/indexedDB';
import { ensureDefaultDecks } from '../services/deckService';
import { getCachedSession, type TursoCredentials } from '../services/vaultService';
import { getTursoClient, syncWithTurso } from '../services/tursoService';

export type AppView = 'decks' | 'study' | 'cards' | 'triage' | 'import' | 'leeches' | 'settings';

interface AppContextType {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  activeDeckId: string | null;
  setActiveDeckId: (id: string | null) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  tursoCreds: TursoCredentials | null;
  setTursoCreds: (creds: TursoCredentials | null) => void;
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncNow: () => Promise<void>;
  stagingCount: number;
  refreshStagingCount: () => Promise<void>;
  leechCount: number;
  refreshLeechCount: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<AppView>('decks');
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  
  // Initialize theme from localStorage or system preference
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ricordo_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [tursoCreds, setTursoCreds] = useState<TursoCredentials | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem('ricordo_last_sync'));
  const [stagingCount, setStagingCount] = useState(0);
  const [leechCount, setLeechCount] = useState(0);

  // Sync theme with DOM class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ricordo_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const refreshStagingCount = async () => {
    const stagingDeck = await db.decks.where('is_staging').equals(1).first();
    if (stagingDeck) {
      const count = await db.notes.where('deck_id').equals(stagingDeck.id).count();
      setStagingCount(count);
    }
  };

  const refreshLeechCount = async () => {
    try {
      const count = await db.cards.where('is_leech').equals(1).count();
      setLeechCount(count);
    } catch (e) {
      console.warn('Could not refresh leech count:', e);
    }
  };

  const syncNow = async () => {
    if (!tursoCreds || isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncWithTurso();
      if (result.success) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(time);
        localStorage.setItem('ricordo_last_sync', time);
      }
    } catch (e) {
      console.error('Manual sync error:', e);
    } finally {
      setIsSyncing(false);
      await refreshStagingCount();
      await refreshLeechCount();
    }
  };

  // Bootstrap app data & cached session
  useEffect(() => {
    const initApp = async () => {
      await ensureDefaultDecks();
      await refreshStagingCount();
      await refreshLeechCount();

      // Check cached session
      const cached = getCachedSession();
      if (cached) {
        setTursoCreds(cached.creds);
        getTursoClient(cached.creds);
        // Initial silent sync
        syncWithTurso().then(res => {
          if (res.success) {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setLastSyncTime(time);
            localStorage.setItem('ricordo_last_sync', time);
          }
        });
      }
    };

    initApp();

    // Foreground sync listener
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncNow();
      }
    };

    const handleOnline = () => {
      syncNow();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        activeDeckId,
        setActiveDeckId,
        theme,
        toggleTheme,
        tursoCreds,
        setTursoCreds,
        isSyncing,
        lastSyncTime,
        syncNow,
        stagingCount,
        refreshStagingCount,
        leechCount,
        refreshLeechCount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

