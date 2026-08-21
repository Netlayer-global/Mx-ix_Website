import { useEffect, useState } from 'react';
import { sitePromoApi, SitePromo } from '../services/api';

/**
 * Fetches the site-wide announcement once per page load and shares the result
 * across every consumer, so the headline bar and the entry popup don't each
 * hit the API.
 */
let cache: SitePromo | null = null;
let inFlight: Promise<SitePromo | null> | null = null;

const load = async (): Promise<SitePromo | null> => {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = sitePromoApi
      .get()
      .then((res) => {
        cache = res.success && res.data ? res.data : null;
        return cache;
      })
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
};

export const useSitePromo = (): { promo: SitePromo | null; loading: boolean } => {
  const [promo, setPromo] = useState<SitePromo | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let active = true;
    if (cache) {
      setPromo(cache);
      setLoading(false);
      return;
    }
    load().then((data) => {
      if (!active) return;
      setPromo(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { promo, loading };
};

export default useSitePromo;
