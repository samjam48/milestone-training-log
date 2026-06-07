// =============================================================================
// DatePickerPopover — compact calendar popover anchored to the date field
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import type { ISODate } from '../../types';

export interface DatePickerPopoverProps {
  value: ISODate;
  maxDate: ISODate;
  todayDate: ISODate;
  onChange: (date: ISODate) => void;
}

const POPOVER_ESTIMATED_HEIGHT = 320;
const POPOVER_GAP_PX = 4;

function parseISODate(iso: ISODate): { year: number; month: number; day: number } {
  const [yearStr, monthStr, dayStr] = iso.split('-');
  return {
    year: Number(yearStr),
    month: Number(monthStr),
    day: Number(dayStr),
  };
}

function toISODate(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` as ISODate;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function weekdayLabels(): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 5, 1 + index));
    return date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
  });
}

export function formatLogDateLabel(iso: ISODate, todayDate: ISODate): string {
  if (iso === todayDate) return 'Today';
  return new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function resolvePlacement(
  anchor: DOMRect,
  viewport: DOMRect,
): 'top' | 'bottom' {
  const spaceBelow = viewport.bottom - anchor.bottom;
  const spaceAbove = anchor.top - viewport.top;

  if (spaceBelow >= POPOVER_ESTIMATED_HEIGHT) return 'bottom';
  if (spaceAbove >= POPOVER_ESTIMATED_HEIGHT) return 'top';
  return spaceBelow >= spaceAbove ? 'bottom' : 'top';
}

export const DatePickerPopover: React.FC<DatePickerPopoverProps> = ({
  value,
  maxDate,
  todayDate,
  onChange,
}) => {
  const popoverId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const [placement, setPlacement] = React.useState<'top' | 'bottom'>('bottom');
  const [position, setPosition] = React.useState<{ top?: number; bottom?: number; left: number }>({
    left: 0,
  });

  const initial = parseISODate(value);
  const [viewYear, setViewYear] = React.useState(initial.year);
  const [viewMonth, setViewMonth] = React.useState(initial.month);

  React.useEffect(() => {
    if (open) {
      const next = parseISODate(value);
      setViewYear(next.year);
      setViewMonth(next.month);
    }
  }, [open, value]);

  React.useLayoutEffect(() => {
    if (!open || triggerRef.current == null) return;

    const anchor = triggerRef.current.getBoundingClientRect();
    const viewport = document.documentElement.getBoundingClientRect();
    const nextPlacement = resolvePlacement(anchor, viewport);
    const left = Math.max(8, Math.min(anchor.left, viewport.width - 280));

    setPlacement(nextPlacement);
    if (nextPlacement === 'bottom') {
      setPosition({ top: anchor.bottom + POPOVER_GAP_PX, left });
    } else {
      setPosition({ bottom: viewport.height - anchor.top + POPOVER_GAP_PX, left });
    }
  }, [open]);

  function close(): void {
    setOpen(false);
  }

  function handleSelect(iso: ISODate): void {
    if (iso > maxDate) return;
    onChange(iso);
    close();
  }

  function shiftMonth(delta: number): void {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setViewYear(nextYear);
    setViewMonth(nextMonth);
  }

  const totalDays = daysInMonth(viewYear, viewMonth);
  // Weekday headers are Mon–Sun; JS getUTCDay() is Sun=0, so shift to Mon=0 … Sun=6.
  const firstWeekday =
    (new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay() + 6) % 7;
  const weekdays = weekdayLabels();
  const cells: Array<{ iso: ISODate; day: number } | null> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({ iso: toISODate(viewYear, viewMonth, day), day });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid="log-date-field"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'flex w-full items-center justify-between rounded-md border border-border bg-bg-sunken',
          'px-3 py-2.5 text-left transition-colors duration-snap hover:bg-bg-overlay',
        )}
      >
        <span className="text-body font-medium text-ink">
          {formatLogDateLabel(value, todayDate)}
        </span>
        <span className="text-caption text-ink-muted">Change</span>
      </button>

      {open && (
        <>
          <div
            data-testid="date-picker-scrim"
            className="fixed inset-0 z-40 bg-black/20"
            onClick={close}
            aria-hidden="true"
          />
          <div
            id={popoverId}
            role="dialog"
            aria-modal="false"
            aria-label="Choose log date"
            data-testid="date-picker-popover"
            data-placement={placement}
            className="fixed z-50 w-fit max-w-sm rounded-xl border border-border bg-bg-raised p-4 shadow-lg"
            style={position}
          >
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="h-9 w-9 rounded-full text-ink-muted hover:bg-bg-overlay"
                aria-label="Previous month"
              >
                ‹
              </button>
              <h2 className="text-body-lg font-semibold text-ink">
                {monthLabel(viewYear, viewMonth)}
              </h2>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="h-9 w-9 rounded-full text-ink-muted hover:bg-bg-overlay"
                aria-label="Next month"
              >
                ›
              </button>
            </div>
            <div className="mb-2 grid grid-cols-7 gap-1">
              {weekdays.map(label => (
                <div key={label} className="py-1 text-center text-caption text-ink-muted">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, index) => {
                if (cell == null) {
                  return <div key={`empty-${index}`} aria-hidden="true" />;
                }
                const isFuture = cell.iso > maxDate;
                const isSelected = cell.iso === value;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    data-testid={`date-picker-day-${cell.iso}`}
                    disabled={isFuture}
                    aria-disabled={isFuture}
                    onClick={() => handleSelect(cell.iso)}
                    className={cn(
                      'h-10 rounded-md text-body font-medium transition-colors duration-snap',
                      isSelected && !isFuture && 'bg-ink text-ink-inverse',
                      !isSelected && !isFuture && 'text-ink hover:bg-bg-overlay',
                      isFuture && 'cursor-not-allowed text-ink-faint opacity-40',
                    )}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
};
