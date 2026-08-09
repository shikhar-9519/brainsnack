import { AgentState } from '../../src/types';

interface AgentBannerProps {
  state: AgentState;
}

interface BannerContent {
  label: string;
  modifier: string;
}

const CONTENT: Record<AgentState, BannerContent | undefined> = {
  [AgentState.WORKING]: {
    label: 'Claude is working — you have a moment',
    modifier: 'banner--working',
  },
  [AgentState.WAITING]: {
    label: 'Claude needs your input',
    modifier: 'banner--waiting',
  },
  [AgentState.FINISHED]: {
    label: 'Claude finished its turn',
    modifier: 'banner--finished',
  },
  [AgentState.IDLE]: undefined,
};

export function AgentBanner({ state }: AgentBannerProps) {
  const content = CONTENT[state];

  if (!content) {
    return null;
  }

  return (
    <div className={`banner ${content.modifier}`} role="status">
      <span className="banner__dot" />

      <span>{content.label}</span>
    </div>
  );
}
