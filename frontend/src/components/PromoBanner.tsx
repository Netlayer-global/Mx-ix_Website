import React, { useEffect, useRef, useState } from 'react';
import { Megaphone, X, ArrowRight } from 'lucide-react';
import useSitePromo from '../hooks/useSitePromo';

const dismissKey = (revision: number) => `mxix-promo-banner-dismissed-v${revision}`;

/**
 * PromoBanner
 * A slim announcement bar pinned above the site navigation.
 *
 * It publishes its own height to the `--promo-h` CSS variable so the fixed
 * navigation and the page content can shift down by exactly the right amount —
 * and back again when the bar is dismissed or switched off in admin.
 */
const PromoBanner: React.FC = () => {
  const { promo } = useSitePromo();
  const [dismissed, setDismissed] = useState(true);
  const ref = useRef<HTMLDivElement | null>(null);

  const banner = promo?.banner;
  const revision = promo?.revision ?? 1;
  const active = !!banner?.enabled && !!banner.message.trim();

  // Restore the per-revision dismissal once we know which revision is live.
  useEffect(() => {
    if (!active) return;
    try {
      setDismissed(localStorage.getItem(dismissKey(revision)) === '1');
    } catch {
      setDismissed(false);
    }
  }, [active, revision]);

  const visible = active && !dismissed;

  // Keep `--promo-h` in sync with the rendered height (also across resizes).
  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.setProperty('--promo-h', '0px');
      return;
    }
    const el = ref.current;
    if (!el) return;

    const apply = () => root.style.setProperty('--promo-h', `${el.offsetHeight}px`);
    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(el);
    window.addEventListener('resize', apply);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', apply);
      root.style.setProperty('--promo-h', '0px');
    };
  }, [visible]);

  if (!visible || !banner) return null;

  const dark = banner.tone === 'ink';
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey(revision), '1');
    } catch {
      /* private mode — dismissal just won't persist */
    }
  };

  const isExternal = /^https?:\/\//i.test(banner.linkUrl);

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Site announcement"
      className={`fixed inset-x-0 top-0 z-[60] ${dark ? 'bg-ink text-white' : 'bg-brand-red text-white'}`}
    >
      <div className="mx-auto flex max-w-[1920px] items-center justify-center gap-3 px-10 py-2.5 sm:px-12">
        <Megaphone className="hidden h-3.5 w-3.5 flex-shrink-0 sm:block" strokeWidth={2.5} aria-hidden="true" />

        <p className="text-center text-[11px] font-bold leading-snug tracking-[0.01em] sm:text-xs">
          {banner.message}
          {banner.linkUrl && banner.linkLabel && (
            <a
              href={banner.linkUrl}
              {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="group ml-2.5 inline-flex cursor-pointer items-center gap-1 underline decoration-white/40 underline-offset-2 transition-colors duration-200 hover:decoration-white"
            >
              {banner.linkLabel}
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          )}
        </p>

        {banner.dismissible && (
          <button
            onClick={dismiss}
            aria-label="Dismiss announcement"
            className="absolute right-3 cursor-pointer rounded-full p-1.5 text-white/70 transition-colors duration-200 hover:bg-white/15 hover:text-white sm:right-5"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
};

export default PromoBanner;
