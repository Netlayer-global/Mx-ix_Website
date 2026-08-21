import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import useSitePromo from '../hooks/useSitePromo';

const seenKey = (revision: number) => `mxix-promo-popup-seen-v${revision}`;

/**
 * PromoModal
 * The announcement shown when a visitor arrives on the site.
 *
 * Shows once per visitor per announcement revision, so editing the message (or
 * using "Show again" in admin) brings it back for everyone. Fully keyboard
 * accessible: focus is moved into the dialog, trapped while open, Escape closes,
 * and focus returns to wherever it was.
 */
const PromoModal: React.FC = () => {
  const { promo } = useSitePromo();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const popup = promo?.popup;
  const revision = promo?.revision ?? 1;
  const active = !!popup?.enabled && !!(popup.title.trim() || popup.body.trim());

  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(seenKey(revision), '1');
    } catch {
      /* private mode — it will simply show again next visit */
    }
    restoreFocusRef.current?.focus?.();
  }, [revision]);

  // Decide whether to open, after a short beat so it doesn't fight the preloader.
  useEffect(() => {
    if (!active) return;
    let seen = false;
    try {
      seen = localStorage.getItem(seenKey(revision)) === '1';
    } catch {
      seen = false;
    }
    if (seen) return;

    const timer = setTimeout(() => {
      restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
      setOpen(true);
    }, 900);
    return () => clearTimeout(timer);
  }, [active, revision]);

  // Lock scroll, trap focus and wire Escape while open.
  useEffect(() => {
    if (!open) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, close]);

  if (!open || !popup) return null;

  const isExternal = (url: string) => /^https?:\/\//i.test(url);
  // When the artwork already carries the message, the panel below is just CTAs.
  const hasCopy = !!(popup.eyebrow || popup.title || popup.body);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
      onClick={close}
    >
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        // An image-only announcement has no heading to point at.
        {...(popup.title ? { 'aria-labelledby': 'promo-modal-title' } : { 'aria-label': 'Announcement' })}
        aria-describedby={popup.body ? 'promo-modal-body' : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_40px_100px_-30px_rgba(10,10,11,0.55)] ${
          popup.imageUrl ? 'max-w-2xl' : 'max-w-lg'
        }`}
      >
        <button
          ref={closeRef}
          onClick={close}
          aria-label="Close announcement"
          className="absolute right-3 top-3 z-10 cursor-pointer rounded-full bg-white/90 p-2 text-gray-500 backdrop-blur transition-colors duration-200 hover:bg-white hover:text-ink"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>

        {/* Scrolls as one piece so tall artwork plus copy always stays reachable. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {popup.imageUrl && (
            <img
              src={popup.imageUrl}
              alt={popup.title ? `${popup.title} announcement` : 'Announcement'}
              className={
                popup.imageFit === 'cover'
                  ? 'max-h-64 w-full object-cover'
                  : // Designed artwork: whole image, and the box hugs it so a
                    // portrait graphic doesn't sit inside empty side bands.
                    'mx-auto block h-auto w-auto max-w-full object-contain'
              }
              style={popup.imageFit === 'cover' ? undefined : { maxHeight: '58vh' }}
            />
          )}

          <div className={hasCopy ? 'p-7 sm:p-8' : 'p-6 sm:p-7'}>
          {popup.eyebrow && <span className="eyebrow text-ink">{popup.eyebrow}</span>}

          {popup.title && (
            <h2
              id="promo-modal-title"
              className={`text-[clamp(1.5rem,4.5vw,2rem)] font-black leading-[1.05] tracking-[-0.04em] text-ink ${
                popup.eyebrow ? 'mt-5' : ''
              }`}
            >
              {popup.title}
            </h2>
          )}

          {popup.body && (
            <p id="promo-modal-body" className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-600">
              {popup.body}
            </p>
          )}

          {(popup.ctaLabel || popup.secondaryLabel) && (
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {popup.ctaLabel && popup.ctaUrl && (
                <a
                  href={popup.ctaUrl}
                  {...(isExternal(popup.ctaUrl) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  onClick={close}
                  className="group inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-3 rounded-full bg-ink px-6 font-mono text-label-sm font-bold uppercase tracking-mono text-white transition-colors duration-200 hover:bg-brand-red"
                >
                  {popup.ctaLabel}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
                </a>
              )}
              {popup.secondaryLabel && popup.secondaryUrl && (
                <a
                  href={popup.secondaryUrl}
                  {...(isExternal(popup.secondaryUrl) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  onClick={close}
                  className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full border border-ink/20 px-6 font-mono text-label-sm font-bold uppercase tracking-mono text-ink transition-colors duration-200 hover:border-ink hover:bg-gray-50"
                >
                  {popup.secondaryLabel}
                </a>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromoModal;
