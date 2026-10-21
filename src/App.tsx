import React from 'react';
import { useApp } from './context/AppContext';
import { Navigation } from './components/Navigation';
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
    <div className="min-h-screen min-h-[100dvh] flex flex-col md:flex-row bg-alabaster dark:bg-forest text-forest dark:text-alabaster font-sans selection:bg-leaf selection:text-white transition-colors duration-200">
      {/* Hide desktop sidebar and mobile header/navbar in study mode for distraction-free focus */}
      {!isStudy && <Navigation />}

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {currentView === 'decks' && <DecksView />}
        {currentView === 'study' && <StudyView />}
        {currentView === 'cards' && <CardsBrowserView />}
        {currentView === 'triage' && <TriageView />}
        {currentView === 'import' && <ImportView />}
        {currentView === 'leeches' && <LeechesView />}
        {currentView === 'settings' && <SettingsView />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return <AppContent />;
};

export default App;

