import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Globe2, Loader2, RefreshCw } from 'lucide-react';
import {
  DEFAULT_PAGE_VISIBILITY,
  PAGE_VISIBILITY_EVENT,
  PAGE_VISIBILITY_STORAGE_KEY,
  PageVisibility,
  PUBLIC_PAGES,
  isPublicPageVisible,
} from '../config/publicPages';
import { settingsApi } from '../services/api';
import { Note, PanelShell } from './admin/ui';

interface PageVisibilityAdminPanelProps {
  embedded?: boolean;
  onBack?: () => void;
}

const GROUPS = ['Main website', 'Resources', 'Utility & legal'] as const;

const PageVisibilityAdminPanel: React.FC<PageVisibilityAdminPanelProps> = ({ embedded, onBack }) => {
  const [visibility, setVisibility] = useState<PageVisibility>({ ...DEFAULT_PAGE_VISIBILITY });
  const [loading, setLoading] = useState(true);
  const [savingPage, setSavingPage] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  const loadVisibility = async () => {
    setLoading(true);
    setNotice(null);
    const response = await settingsApi.get();
    if (response.success && response.data) {
      setVisibility({ ...DEFAULT_PAGE_VISIBILITY, ...response.data.siteVisibility });
    } else {
      setNotice({ tone: 'error', text: response.error || 'Page visibility settings could not be loaded.' });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVisibility();
  }, []);

  const togglePage = async (pageId: string) => {
    const nextVisibility = { ...visibility, [pageId]: !isPublicPageVisible(visibility, pageId) };
    const page = PUBLIC_PAGES.find((item) => item.id === pageId);
    setVisibility(nextVisibility);
    setSavingPage(pageId);
    setNotice(null);

    const response = await settingsApi.update({ siteVisibility: nextVisibility });
    if (response.success) {
      const isVisible = isPublicPageVisible(nextVisibility, pageId);
      window.localStorage.setItem(PAGE_VISIBILITY_STORAGE_KEY, JSON.stringify(nextVisibility));
      window.dispatchEvent(new CustomEvent(PAGE_VISIBILITY_EVENT, { detail: nextVisibility }));
      setNotice({
        tone: 'success',
        text: `${page?.label || 'Page'} is now ${isVisible ? 'visible' : 'hidden'} on the public website.`,
      });
    } else {
      setVisibility(visibility);
      setNotice({ tone: 'error', text: response.error || 'The visibility change could not be saved.' });
    }
    setSavingPage(null);
  };

  return (
    <PanelShell
      title="Page Visibility"
      subtitle="Show or hide public website pages"
      icon={Globe2}
      embedded={embedded}
      onBack={onBack}
      actions={
        <button
          type="button"
          onClick={loadVisibility}
          disabled={loading || savingPage !== null}
          className="inline-flex items-center gap-2 rounded bg-gray-700 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Reload
        </button>
      }
    >
      <Note tone="info">
        Hidden pages are removed from the website navigation and footer. Visiting their URL directly shows a 404 page. Changes apply immediately to the public site in this browser.
      </Note>

      {notice && <Note tone={notice.tone}>{notice.text}</Note>}

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#F20732]" />
        </div>
      ) : (
        GROUPS.map((group) => {
          const pages = PUBLIC_PAGES.filter((page) => page.group === group);
          return (
            <section key={group} aria-labelledby={`visibility-${group.replace(/[^a-z]/gi, '-').toLowerCase()}`}>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 id={`visibility-${group.replace(/[^a-z]/gi, '-').toLowerCase()}`} className="font-mono text-xs font-bold uppercase tracking-wider text-gray-400">
                  {group}
                </h2>
                <span className="text-xs text-gray-500">{pages.filter((page) => isPublicPageVisible(visibility, page.id)).length} of {pages.length} visible</span>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {pages.map((page) => {
                  const visible = isPublicPageVisible(visibility, page.id);
                  const saving = savingPage === page.id;
                  return (
                    <article key={page.id} className="flex items-center gap-4 rounded-lg border border-gray-700 bg-gray-800 p-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-700 text-gray-500" aria-hidden="true">
                        {visible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-white">{page.label}</h3>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-gray-500">{page.path}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePage(page.id)}
                        disabled={savingPage !== null}
                        aria-label={`${visible ? 'Hide' : 'Show'} ${page.label}`}
                        className={`inline-flex min-w-[102px] cursor-pointer items-center justify-center gap-2 rounded px-3 py-2.5 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F20732] focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-50 ${
                          visible
                            ? 'bg-[#F20732] text-white hover:bg-[#C00628]'
                            : 'bg-gray-700 text-white hover:bg-gray-600'
                        }`}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {saving ? 'Saving...' : visible ? 'Hide page' : 'Show page'}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      <p className="text-xs leading-relaxed text-gray-500">
        Admin and Member Portal routes are intentionally not listed, so management access remains available.
      </p>
    </PanelShell>
  );
};

export default PageVisibilityAdminPanel;
