import type { ReactNode } from 'react';
import type { Screen } from '../types';
import { STORE } from '../data/mock';
import { Icon, type IconName } from './Icon';

const TABS: { screen: Screen; label: string; icon: IconName }[] = [
  { screen: 'home', label: '홈', icon: 'home' },
  { screen: 'inventory', label: '재고', icon: 'box' },
  { screen: 'expiry', label: '유통기한', icon: 'clock' },
  { screen: 'recommend', label: 'AI 발주', icon: 'sparkle' },
];

interface Props {
  screen: Screen;
  badges: Partial<Record<Screen, number>>;
  onNav: (s: Screen) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function Layout({ screen, badges, onNav, onLogout, children }: Props) {
  const active: Screen = screen === 'draft' ? 'recommend' : screen;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="sparkle" size={20} />
          </span>
          <div>
            <strong>{STORE.name}</strong>
            <small>AI 운영관리</small>
          </div>
        </div>
        <nav aria-label="주요 메뉴">
          {TABS.map((t) => (
            <button
              key={t.screen}
              className={`nav-item ${active === t.screen ? 'is-active' : ''}`}
              aria-current={active === t.screen ? 'page' : undefined}
              onClick={() => onNav(t.screen)}
            >
              <Icon name={t.icon} />
              <span>{t.label}</span>
              {!!badges[t.screen] && <em className="count">{badges[t.screen]}</em>}
            </button>
          ))}
        </nav>
        <button className="nav-item logout" onClick={onLogout}>
          <Icon name="logout" />
          <span>로그아웃</span>
        </button>
      </aside>

      <header className="topbar">
        <strong>{STORE.name}</strong>
        <button className="link-btn" onClick={onLogout}>
          로그아웃
        </button>
      </header>

      <main className="main">{children}</main>

      <nav className="tabbar" aria-label="주요 메뉴">
        {TABS.map((t) => (
          <button
            key={t.screen}
            className={`tab ${active === t.screen ? 'is-active' : ''}`}
            aria-current={active === t.screen ? 'page' : undefined}
            onClick={() => onNav(t.screen)}
          >
            <span className="tab-icon">
              <Icon name={t.icon} />
              {!!badges[t.screen] && <em className="count">{badges[t.screen]}</em>}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
