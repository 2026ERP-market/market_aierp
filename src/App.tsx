import { useState } from 'react';
import type { Screen } from './types';
import { StoreProvider, useStore } from './store';
import { Layout } from './components/Layout';
import { Login } from './screens/Login';
import { Home } from './screens/Home';
import { Inventory } from './screens/Inventory';
import { Expiry } from './screens/Expiry';
import { Recommend } from './screens/Recommend';
import { Draft } from './screens/Draft';

export function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;
  return (
    <StoreProvider>
      <Shell onLogout={() => setLoggedIn(false)} />
    </StoreProvider>
  );
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const { recs, lots, analyses } = useStore();
  const [screen, setScreen] = useState<Screen>('home');
  const [filter, setFilter] = useState<string | undefined>();

  const nav = (s: Screen, f?: string) => {
    setFilter(f);
    setScreen(s);
    window.scrollTo({ top: 0 });
  };

  const badges = {
    inventory: analyses.filter((a) => a.status !== 'ok').length,
    expiry: lots.filter((l) => l.daysLeft <= 3).length,
    recommend: recs.length,
  };

  return (
    <Layout screen={screen} badges={badges} onNav={nav} onLogout={onLogout}>
      {screen === 'home' && <Home onNav={nav} />}
      {screen === 'inventory' && <Inventory key={filter ?? 'all'} initialFilter={filter} onNav={nav} />}
      {screen === 'expiry' && <Expiry onNav={nav} />}
      {screen === 'recommend' && <Recommend onNav={nav} />}
      {screen === 'draft' && <Draft onNav={nav} />}
    </Layout>
  );
}
