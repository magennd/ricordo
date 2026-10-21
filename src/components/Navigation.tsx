import React, { useState } from 'react';
import { 
  Layers, 
  BookOpen, 
  Inbox, 
  UploadCloud, 
  AlertOctagon, 
  Settings, 
  Moon, 
  Sun, 
  RefreshCw,
  Sparkles,
  Lock
} from 'lucide-react';
import { useApp, type AppView } from '../context/AppContext';
import { SignInModal } from './SignInModal';

export const Navigation: React.FC = () => {
  const { 
    currentView, 
    setCurrentView, 
    theme, 
    toggleTheme, 
    stagingCount, 
    leechCount,
    isSyncing,
    syncNow,
    tursoCreds,
    lastSyncTime
  } = useApp();

  const [isSignInOpen, setIsSignInOpen] = useState(false);

  const navItems: { view: AppView; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    { view: 'decks', label: 'Decks', icon: <Layers className="w-5 h-5" /> },
    { view: 'cards', label: 'Cards & Notes', icon: <BookOpen className="w-5 h-5" /> },
    { 
      view: 'triage', 
      label: 'Dictionary Triage', 
      icon: <Inbox className="w-5 h-5" />, 
      badge: stagingCount,
      badgeColor: 'bg-leaf text-forest font-semibold'
    },
    { view: 'import', label: 'Import CSV', icon: <UploadCloud className="w-5 h-5" /> },
    { 
      view: 'leeches', 
      label: 'Leech Cards', 
      icon: <AlertOctagon className="w-5 h-5" />, 
      badge: leechCount,
      badgeColor: 'bg-coral text-white font-semibold'
    },
    { view: 'settings', label: 'Cloud & Vault', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <>
      {/* Desktop Sidebar (Persistent Left #012615) */}
      <aside className="hidden md:flex flex-col w-64 bg-forest text-alabaster min-h-screen border-r border-forest-panel/50 p-5 select-none shrink-0">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-4 mb-4">
          <div className="w-9 h-9 rounded-xl bg-leaf flex items-center justify-center text-forest shadow-sm">
            <Sparkles className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-alabaster">Ricordo</h1>
            <p className="text-xs text-alabaster/60 tracking-wide font-sans">Spaced Repetition SRS</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => setCurrentView(item.view)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-sans text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-alabaster text-forest font-semibold shadow-sm'
                    : 'text-alabaster/80 hover:bg-forest-panel hover:text-alabaster'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 text-xs rounded-full tabular-nums ${item.badgeColor || 'bg-leaf text-forest'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Utility Controls */}
        <div className="pt-4 border-t border-forest-panel/60 space-y-3">
          {/* Cloud Sync Status / Sign In Button */}
          {tursoCreds ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-forest-panel/50 text-xs text-alabaster/70">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-leaf shrink-0" />
                <span className="truncate">
                  {lastSyncTime ? `Synced ${lastSyncTime}` : 'Cloud ready'}
                </span>
              </div>
              <button
                onClick={syncNow}
                disabled={isSyncing}
                title="Sync with Turso"
                className="p-1 hover:text-alabaster transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-leaf' : ''}`} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSignInOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-forest-panel/80 hover:bg-forest-panel text-xs text-alabaster transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-leaf" />
                <span className="font-semibold">Sign In to Cloud</span>
              </div>
              <span className="text-[10px] bg-leaf/20 text-leaf px-1.5 py-0.5 rounded font-mono">
                Connect
              </span>
            </button>
          )}

          {/* Theme Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-alabaster/80 hover:bg-forest-panel transition-colors"
          >
            <div className="flex items-center gap-2.5">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-leaf" /> : <Sun className="w-4 h-4 text-coral" />}
              <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <span className="text-[11px] uppercase tracking-wider text-alabaster/40 font-mono">Toggle</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-forest text-alabaster border-b border-forest-panel sticky top-0 z-40 safe-top">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-leaf flex items-center justify-center text-forest">
            <Sparkles className="w-4 h-4 fill-current" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">Ricordo</span>
        </div>

        <div className="flex items-center gap-2">
          {!tursoCreds && (
            <button
              onClick={() => setIsSignInOpen(true)}
              className="text-[11px] font-semibold bg-leaf text-forest px-2.5 py-1 rounded-lg flex items-center gap-1"
            >
              <Lock className="w-3 h-3" />
              <span>Sign In</span>
            </button>
          )}
          {tursoCreds && (
            <button
              onClick={syncNow}
              disabled={isSyncing}
              className="p-2 text-alabaster/80 hover:text-alabaster"
              aria-label="Sync"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-leaf' : ''}`} />
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="p-2 text-alabaster/80 hover:text-alabaster"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Moon className="w-4 h-4 text-leaf" /> : <Sun className="w-4 h-4 text-coral" />}
          </button>
        </div>
      </header>

      {/* Sign In Modal */}
      <SignInModal isOpen={isSignInOpen} onClose={() => setIsSignInOpen(false)} />

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-forest text-alabaster border-t border-forest-panel flex justify-around items-center py-2 px-1 z-40 safe-bottom">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-sans transition-colors ${
                isActive ? 'text-leaf font-semibold' : 'text-alabaster/70'
              }`}
            >
              {item.icon}
              <span className="text-[10px]">{item.label.split(' ')[0]}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-0 right-1 w-2 h-2 rounded-full bg-coral ring-2 ring-forest" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};

