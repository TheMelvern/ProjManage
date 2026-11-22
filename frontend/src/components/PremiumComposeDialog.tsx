import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import './PremiumComposeDialog.css';

interface Props {
  open: boolean;
  title: string;
  eyebrow?: string;
  description?: string;
  error?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

export function PremiumComposeDialog({
  open, title, eyebrow = 'NEW RECORD', description, error, children, footer, onClose,
}: Props) {
  const heading = useId();
  const dialog = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="premium-compose-overlay"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
        if (event.key !== 'Tab' || !dialog.current) return;
        const items = [...dialog.current.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],[tabindex]')]
          .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && node.getClientRects().length);
        const destination = event.shiftKey ? items.at(-1) : items[0];
        if (!destination || document.activeElement === dialog.current ||
          document.activeElement === (event.shiftKey ? items[0] : items.at(-1))) {
          event.preventDefault();
          destination?.focus();
        }
      }}>
      <section ref={dialog} className="premium-compose-dialog" role="dialog" aria-modal="true" aria-labelledby={heading} tabIndex={-1}>
        <header className="premium-compose-header">
          <div className="premium-compose-heading">
            <p className="premium-compose-eyebrow">{eyebrow}</p>
            <h2 id={heading}>{title}</h2>
            {description && <p className="premium-compose-description">{description}</p>}
          </div>
          <button className="premium-compose-close" type="button" aria-label="Close creation dialog" onClick={onClose}>
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </header>
        <div className="premium-compose-body">{error && <p className="premium-compose-error" role="alert">{error}</p>}{children}</div>
        {footer && <footer className="premium-compose-footer">{footer}</footer>}
      </section>
    </div>
  );
}
