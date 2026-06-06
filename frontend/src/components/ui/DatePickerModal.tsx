// =============================================================================
// DatePickerModal — calendar picker with maxDate guard (no future dates)
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import type { ISODate } from '../../types';

export interface DatePickerModalProps {
  open: boolean;
  value: ISODate;
  maxDate: ISODate;
  onClose: () => void;
  onChange: (date: ISODate) => void;
}

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

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  open,
  value,
  maxDate,
  onClose,
  onChange,
}) => {
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

  if (!open) return null;

  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstWeekday = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
  const weekdays = weekdayLabels();
  const cells: Array<{ iso: ISODate; day: number } | null> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({ iso: toISODate(viewYear, viewMonth, day), day });
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

  function handleSelect(iso: ISODate): void {
    if (iso > maxDate) return;
    onChange(iso);
    onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60"
        style={{ backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose log date"
        data-testid="date-picker-modal"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] rounded-t-2xl bg-bg-raised border-t border-border pb-safe-bottom"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>
        <div className="px-4 pb-6 pt-2">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="h-9 w-9 rounded-full text-ink-muted hover:bg-bg-overlay"
              aria-label="Previous month"
            >
              ‹
            </button>
            <h2 className="text-body-lg font-semibold text-ink">{monthLabel(viewYear, viewMonth)}</h2>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="h-9 w-9 rounded-full text-ink-muted hover:bg-bg-overlay"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekdays.map(label => (
              <div key={label} className="text-center text-caption text-ink-muted py-1">
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
                    isFuture && 'text-ink-faint cursor-not-allowed opacity-40',
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};
