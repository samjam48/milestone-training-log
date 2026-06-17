import * as React from 'react';
import { cn } from '../../lib/cn';

interface DeleteButtonProps {
  'aria-label': string;
  onClick: () => void;
  className?: string;
}

export const DeleteButton: React.FC<DeleteButtonProps> = ({
  'aria-label': ariaLabel,
  onClick,
  className,
}) => (
  <button
    type="button"
    aria-label={ariaLabel}
    onClick={onClick}
    className={cn(
      'flex min-w-11 min-h-11 items-center justify-center',
      'text-danger-fg/50 hover:text-danger-fg',
      'transition-colors duration-snap rounded-sm',
      className,
    )}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  </button>
);
