import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

export type SelectValue = string | number;
export type SelectOption = string | { value: SelectValue; label: string };

interface Props {
  modelValue?: SelectValue;
  options: readonly SelectOption[];
  id?: string;
  ariaLabel?: string;
  filterLabel?: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: SelectValue) => void;
}

export function SmartSelect({
  modelValue = '', options, id, ariaLabel, filterLabel, disabled,
  placeholder = 'Select an option', onChange,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState({ opensUp: false, height: 248 });
  const listId = useId();
  const normalized = options.map(option => typeof option === 'string' ? { value: option, label: option } : option);
  const selectedIndex = normalized.findIndex(option => option.value === modelValue);
  const selected = normalized[selectedIndex];
  const last = normalized.length - 1;
  const active = Math.min(activeIndex, last);
  const open = expanded && !disabled;

  function optionId(index: number) {
    return listId + '-' + index;
  }

  function show(fallback = 0) {
    setActiveIndex(selectedIndex < 0 ? fallback : selectedIndex);
    setExpanded(true);
  }

  function choose(value: SelectValue) {
    setExpanded(false);
    if (value !== modelValue) onChange(value);
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        if (open) setActiveIndex(Math.max(0, Math.min(last, active + direction)));
        else show(direction > 0 ? 0 : last);
        break;
      }
      case 'Home':
      case 'End':
        if (!open) break;
        event.preventDefault();
        setActiveIndex(event.key === 'Home' ? 0 : last);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!open) show();
        else if (normalized[active]) choose(normalized[active].value);
        break;
      case 'Escape':
        if (!open) break;
        event.stopPropagation();
        setExpanded(false);
        break;
    }
  }

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const bounds = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - bounds.bottom - 12;
    const above = bounds.top - 12;
    const opensUp = below < Math.min(248, options.length * 40 + 12) && above > below;
    setPlacement({ opensUp, height: Math.max(40, Math.min(248, opensUp ? above : below)) });
  }, [open, options.length]);

  useLayoutEffect(() => {
    const list = menu.current;
    const option = list?.children[active];
    if (!list || !(option instanceof HTMLElement)) return;
    const bottom = option.offsetTop + option.offsetHeight;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [open, active, placement]);

  useEffect(() => {
    if (disabled) setExpanded(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setExpanded(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  return (
    <div ref={root} className={filterLabel ? 'smart-select smart-select-filter' : 'smart-select'}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }}>
      <button id={id} ref={trigger} type="button" className="smart-trigger" disabled={disabled}
        role="combobox" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined} aria-label={ariaLabel}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        onClick={() => { if (open) setExpanded(false); else show(); }} onKeyDown={handleKey}>
        {filterLabel && <span className="smart-filter-label" aria-hidden="true">{filterLabel}</span>}
        <span className={selected ? 'smart-value' : 'smart-value placeholder'} title={selected?.label}>
          {selected?.label || placeholder}
        </span>
        <svg className="smart-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div ref={menu} id={listId} className={placement.opensUp ? 'smart-menu opens-up' : 'smart-menu'}
          style={{ maxBlockSize: placement.height }} role="listbox" aria-label={ariaLabel || 'Choose option'}>
          {normalized.length === 0 && <div className="smart-empty">No options available</div>}
          {normalized.map((option, index) => (
            <div id={optionId(index)} key={option.value} role="option" aria-selected={modelValue === option.value}
              className={index === active ? 'active' : undefined} onPointerDown={event => event.preventDefault()}
              onClick={() => choose(option.value)}>
              <span>{option.label}</span>
              {modelValue === option.value && (
                <svg className="smart-check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
