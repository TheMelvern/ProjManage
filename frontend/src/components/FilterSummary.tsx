import { useRef } from 'react';

export interface FilterChip {
  key: string;
  label: string;
  value: string;
}

export interface FilterSummaryProps {
  chips: readonly FilterChip[];
  count: number;
  total: number;
  noun?: string;
}

interface Props extends FilterSummaryProps {
  onRemove: (key: string) => void;
  onClear: () => void;
}

export function FilterSummary({ chips, count, total, noun = 'results', onRemove, onClear }: Props) {
  const resultCount = useRef<HTMLSpanElement>(null);

  function changeFilters(update: () => void) {
    update();
    resultCount.current?.focus({ preventScroll: true });
  }

  return (
    <div className="filter-summary">
      {chips.length > 0 && (
        <div className="filter-chips" role="group" aria-label="Active filters">
          {chips.map(chip => (
            <button key={chip.key} type="button" className="filter-chip"
              aria-label={`Remove ${chip.label} filter`} onClick={() => changeFilters(() => onRemove(chip.key))}>
              <span><small>{chip.label}</small> {chip.value}</span>
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          ))}
          <button type="button" className="filter-clear" onClick={() => changeFilters(onClear)}>
            Clear filters
          </button>
        </div>
      )}
      <span ref={resultCount} className="filter-result-count" role="status" tabIndex={-1}>
        {count} of {total} {noun}
      </span>
    </div>
  );
}
