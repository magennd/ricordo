import React from 'react';
import { useApp } from './context/AppContext';
import { Navigation, MobileBottomNav } from './components/Navigation';
import { DecksView } from './views/DecksView';
import { StudyView } from './views/StudyView';
import { CardsBrowserView } from './views/CardsBrowserView';
import { TriageView } from './views/TriageView';
import { ImportView } from './views/ImportView';
import { LeechesView } from './views/LeechesView';
import { SettingsView } from './views/SettingsView';

export const AppContent: React.FC = () => {
  const { currentView } = useApp();

  const isStudy = currentView === 'study';

  return (
    <div className="h-screen h-[100dvh] flex flex-col md:flex-row bg-alabaster dark:bg-forest text-forest dark:text-alabaster font-sans selection:bg-leaf selection:text-white transition-colors duration-200 overflow-hidden">
      {/* Hide desktop sidebar and mobile header in study mode for distraction-free focus */}
      {!isStudy && <Navigation />}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {currentView === 'decks' && <DecksView />}
          {currentView === 'study' && <StudyView />}
          {currentView === 'cards' && <CardsBrowserView />}
          {currentView === 'triage' && <TriageView />}
          {currentView === 'import' && <ImportView />}
          {currentView === 'leeches' && <LeechesView />}
          {currentView === 'settings' && <SettingsView />}
        </main>

        {/* Mobile Bottom Navigation Bar: Docked cleanly at the bottom, never floating */}
        {!isStudy && <MobileBottomNav />}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return <AppContent />;
};

export default App;

