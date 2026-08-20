export type PublicPageId =
  | 'home'
  | 'about'
  | 'services'
  | 'locations'
  | 'networks'
  | 'members'
  | 'stats'
  | 'pricing'
  | 'contact'
  | 'technical'
  | 'lg'
  | 'status'
  | 'google-vpp'
  | 'content-fabric'
  | 'onboarding'
  | 'privacy'
  | 'terms';

export interface PublicPageDefinition {
  id: PublicPageId;
  label: string;
  path: string;
  group: 'Main website' | 'Resources' | 'Utility & legal';
}

/**
 * Pages that can be switched on or off from the admin panel. The admin panel
 * and member portal deliberately stay outside this list so an editor cannot
 * lock everyone out of the controls.
 */
export const PUBLIC_PAGES: PublicPageDefinition[] = [
  { id: 'home', label: 'Homepage', path: '/', group: 'Main website' },
  { id: 'about', label: 'About', path: '/about', group: 'Main website' },
  { id: 'services', label: 'Services', path: '/services', group: 'Main website' },
  { id: 'locations', label: 'Locations', path: '/locations', group: 'Main website' },
  { id: 'networks', label: 'Networks', path: '/networks', group: 'Main website' },
  { id: 'members', label: 'Members', path: '/members', group: 'Main website' },
  { id: 'pricing', label: 'Pricing', path: '/pricing', group: 'Main website' },
  { id: 'contact', label: 'Contact', path: '/contact', group: 'Main website' },
  { id: 'content-fabric', label: 'Content Fabric', path: '/content-fabric', group: 'Resources' },
  { id: 'google-vpp', label: 'Google VPP Program', path: '/resources/google-vpp-program', group: 'Resources' },
  { id: 'stats', label: 'Network Stats', path: '/stats', group: 'Resources' },
  { id: 'technical', label: 'Technical Requirements', path: '/technical', group: 'Resources' },
  { id: 'lg', label: 'Looking Glass', path: '/looking-glass', group: 'Resources' },
  { id: 'status', label: 'System Status', path: '/status', group: 'Resources' },
  { id: 'onboarding', label: 'Onboarding', path: '/onboarding', group: 'Utility & legal' },
  { id: 'privacy', label: 'Privacy Policy', path: '/privacy', group: 'Utility & legal' },
  { id: 'terms', label: 'Terms & Conditions', path: '/terms', group: 'Utility & legal' },
];

export type PageVisibility = Record<string, boolean>;

export const DEFAULT_PAGE_VISIBILITY: PageVisibility = Object.fromEntries(
  PUBLIC_PAGES.map((page) => [page.id, true])
);

export const PAGE_VISIBILITY_STORAGE_KEY = 'mx-ix-page-visibility';
export const PAGE_VISIBILITY_EVENT = 'mx-ix-page-visibility-updated';

export const isPublicPageVisible = (visibility: PageVisibility, pageId: string): boolean =>
  visibility[pageId] !== false;
