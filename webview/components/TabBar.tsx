import { CARD_TYPE_LABELS } from '../../src/types';
import type { CardType } from '../../src/types';

export const ALL_TAB = 'all';
export const SAVED_TAB = 'saved';

interface TabBarProps {
  interests: CardType[];
  activeTab: string;
  onSelect: (tab: string) => void;
}

interface Tab {
  id: string;
  label: string;
}

interface TabButtonProps {
  tab: Tab;
  isActive: boolean;
  onSelect: (tab: string) => void;
}

function TabButton({ tab, isActive, onSelect }: TabButtonProps) {
  const className = isActive ? 'tab tab--active' : 'tab';

  return (
    <button
      type="button"
      className={className}
      onClick={() => onSelect(tab.id)}
      aria-pressed={isActive}
    >
      {tab.label}
    </button>
  );
}

export function TabBar({ interests, activeTab, onSelect }: TabBarProps) {
  const tabs: Tab[] = [
    { id: ALL_TAB, label: 'All' },
    ...interests.map(type => ({ id: type, label: CARD_TYPE_LABELS[type] })),
    { id: SAVED_TAB, label: 'Saved' },
  ];

  return (
    <nav className="tabs">
      {tabs.map(tab => (
        <TabButton
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTab}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
}
