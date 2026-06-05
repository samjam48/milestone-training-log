import * as React from 'react';

interface BackButtonProps {
  onPress: () => void;
}

/** Tier 3 / stack screen back affordance. Top safe-area inset comes from AppShell or stack overlay. */
export const BackButton: React.FC<BackButtonProps> = ({ onPress }) => (
  <div data-testid="screen-back-header" className="shrink-0">
    <button
      type="button"
      onClick={onPress}
      className="flex items-center gap-1.5 py-1 text-body text-ink-muted transition-colors duration-snap hover:text-ink"
      aria-label="Go back"
    >
      <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M12.5 15l-5-5 5-5"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Back
    </button>
  </div>
);
