import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import './SmartDatePicker.css';

interface Props {
  modelValue?: string;
  id?: string;
  ariaLabel?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  onChange: (value: string) => void;
}

const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const offsets: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

function iso(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function parse(date: string) {
  return new Date(date + 'T12:00:00');
}

function calendarCells(view: Date) {
  const year = view.getFullYear();
  const month = view.getMonth();
  const start = (new Date(year, month, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, 1 - start + index);
    return {
      key: iso(date),
      day: date.getDate(),
      current: date.getMonth() === month,
      label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    };
  });
}

export function SmartDatePicker({ modelValue = '', id, ariaLabel, min, max, disabled, required, onChange }: Props) {
  const today = iso(new Date());
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parse(modelValue || today));
  const [focusedDate, setFocusedDate] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef(false);
  const cells = calendarCells(view);

  function bounded(date: string) {
    if (min && date < min) return min;
    if (max && date > max) return max;
    return date;
  }

  function focusDate(date: string) {
    pendingFocus.current = true;
    setFocusedDate(date);
    setView(parse(date));
  }

  useLayoutEffect(() => {
    if (!open || !pendingFocus.current) return;
    pendingFocus.current = false;
    root.current?.querySelector<HTMLElement>(`[data-date="${focusedDate}"]`)?.focus();
  }, [open, focusedDate, view]);

  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(modelValue)) setView(parse(modelValue));
  }, [modelValue]);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function shift(months: number) {
    const next = new Date(view.getFullYear(), view.getMonth() + months, 1);
    setView(next);
    setFocusedDate(calendarCells(next).find(date => date.current && bounded(date.key) === date.key)?.key || '');
  }

  function moveDay(event: KeyboardEvent, date: string) {
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const next = parse(date);
    next.setDate(next.getDate() + offset);
    focusDate(bounded(iso(next)));
  }

  function pick(date: string) {
    if (date && bounded(date) !== date) return;
    onChange(date);
    close();
  }

  return (
    <div ref={root} className={disabled ? 'date-select disabled' : 'date-select'} onKeyDown={event => {
      if (!open || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close();
    }}>
      <button id={id} ref={trigger} type="button" className="date-trigger" disabled={disabled}
        aria-label={ariaLabel || 'Choose date'} aria-expanded={open} aria-haspopup="dialog"
        onClick={() => {
          if (open) close();
          else {
            setOpen(true);
            focusDate(bounded(modelValue || today));
          }
        }}>
        <span>{modelValue ? parse(modelValue).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select date'}</span>
        <span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>
      </button>
      {open && <div className="date-popover" role="dialog" aria-label={ariaLabel || 'Date picker'}>
        <div className="calendar-heading">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)}>{'\u2039'}</button>
          <strong>{view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</strong>
          <button type="button" aria-label="Next month" onClick={() => shift(1)}>{'\u203a'}</button>
        </div>
        <div className="calendar-grid">
          {weekdays.map((day, index) => <span key={index} className="weekday">{day}</span>)}
          {cells.map(date => <button key={date.key} type="button" disabled={!date.current || bounded(date.key) !== date.key}
            aria-label={date.label} data-date={date.key} tabIndex={focusedDate === date.key ? 0 : -1}
            onKeyDown={event => moveDay(event, date.key)} aria-pressed={modelValue === date.key}
            className={modelValue === date.key ? 'selected' : date.key === today ? 'today' : undefined}
            onClick={() => pick(date.key)}>{date.day}</button>)}
        </div>
        <div className="date-footer">
          <button type="button" disabled={required} onClick={() => pick('')}>Clear</button>
          <button type="button" disabled={bounded(today) !== today} onClick={() => pick(today)}>Today</button>
        </div>
      </div>}
    </div>
  );
}
