import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, 'dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');

if (!fs.existsSync(INDEX_HTML_PATH)) {
  console.error('Error: dist/index.html not found. Please run "npm run build" first.');
  process.exit(1);
}

const PAGE_TITLES = {
  home: 'MX-IX — Carrier-Neutral Internet Exchange & Peering',
  about: 'About — MX-IX Internet Exchange',
  services: 'Services — Peering, Cloud Connect & DDoS Protection | MX-IX',
  locations: 'Locations — MX-IX Points of Presence',
  networks: 'Connected Networks — MX-IX Members',
  members: 'Members — MX-IX Connected Networks',
  stats: 'Traffic Stats — MX-IX',
  pricing: 'Pricing — MX-IX Port & Peering Pricing',
  contact: 'Request a Port — MX-IX',
  technical: 'Technical Requirements — MX-IX',
  'looking-glass': 'Looking Glass — MX-IX Route Servers',
  status: 'System Status — MX-IX',
  'google-vpp': 'Google VPP Program — MX-IX',
  'content-fabric': 'Content Fabric — Aggregated Route Reach | MX-IX',
  portal: 'Member Portal — MX-IX',
  onboarding: 'Become a Member — MX-IX Onboarding',
  privacy: 'Privacy Policy — MX-IX',
  terms: 'Terms & Conditions — MX-IX',
};

const PAGE_DESCRIPTIONS = {
  home: 'MX-IX is a carrier-neutral Internet Exchange where networks peer directly — lower latency, reduced transit costs and resilient interconnection.',
  about: 'MX-IX is a carrier- and data-center-neutral Internet Exchange. Learn about our mission to make interconnection simple, open and accessible.',
  services: 'Public and private peering, cloud connectivity and DDoS protection on the MX-IX fabric — everything your network needs to interconnect.',
  locations: 'MX-IX points of presence and data centers. Explore route servers, connected ASNs and enabled sites across our locations.',
  networks: 'Browse the networks peering at MX-IX — ASNs, peering policies and session status across our route servers.',
  members: 'The networks connected to MX-IX — ISPs, content, cloud and enterprise networks peering across the exchange.',
  stats: 'Real-time and historical traffic statistics for the MX-IX Internet Exchange.',
  pricing: 'Simple, scalable MX-IX port pricing from 1G to 400G. One connection unlocks the entire peering ecosystem — no traffic charges.',
  contact: 'Request a port at MX-IX. Tell us about your network and our team will share availability and pricing.',
  technical: 'Technical requirements, BGP configuration and operational standards for connecting to the MX-IX shared fabric.',
  'looking-glass': 'MX-IX Looking Glass — inspect BGP sessions, route servers and routing tables across the exchange in real time.',
  status: 'Live operational status of MX-IX route servers, peering fabric and locations, plus incident history.',
  'google-vpp': 'Google’s Verified Peering Provider programme explained — what it unlocks, what Google looks for, and how peering at MX-IX supports your application.',
  'content-fabric': 'MX-IX Content Fabric — one managed BGP session that consolidates our peering reach and interconnection capacity into a single RPKI-validated route set.',
  portal: 'MX-IX Member Portal — manage your ports, peering sessions, traffic and account.',
  onboarding: 'Join MX-IX in a few quick steps — set up your member account and request your first port.',
  privacy: 'How MX-IX collects, uses, shares and protects your personal data.',
  terms: 'The terms governing your use of the MX-IX website, member portal and interconnection services.',
};

const PATHS = {
  about: '/about',
  services: '/services',
  locations: '/locations',
  networks: '/networks',
  members: '/members',
  stats: '/stats',
  pricing: '/pricing',
  contact: '/contact',
  technical: '/technical',
  'looking-glass': '/looking-glass',
  status: '/status',
  'google-vpp': '/resources/google-vpp-program',
  'content-fabric': '/content-fabric',
  portal: '/portal',
  onboarding: '/onboarding',
  privacy: '/privacy',
  terms: '/terms',
};

const baseHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');

console.log('Generating pre-rendered subpages for SEO...');

Object.entries(PATHS).forEach(([pageKey, urlPath]) => {
  const title = PAGE_TITLES[pageKey] || PAGE_TITLES.home;
  const desc = PAGE_DESCRIPTIONS[pageKey] || PAGE_DESCRIPTIONS.home;
  const url = `https://mx-ix.com${urlPath}`;

  let html = baseHtml;

  // Replace Title
  html = html.replace(/<title>[^<]*<\/title>/g, `<title>${title}</title>`);

  // Replace Meta Description
  if (html.includes('name="description"')) {
    html = html.replace(/<meta name="description" content="[^"]*"/g, `<meta name="description" content="${desc}"`);
  } else {
    html = html.replace('</head>', `    <meta name="description" content="${desc}" />\n  </head>`);
  }

  // Replace Open Graph / Twitter Tags
  html = html.replace(/<meta property="og:title" content="[^"]*"/g, `<meta property="og:title" content="${title}"`);
  html = html.replace(/<meta property="og:description" content="[^"]*"/g, `<meta property="og:description" content="${desc}"`);
  html = html.replace(/<meta property="og:url" content="[^"]*"/g, `<meta property="og:url" content="${url}"`);
  
  html = html.replace(/<meta name="twitter:title" content="[^"]*"/g, `<meta name="twitter:title" content="${title}"`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*"/g, `<meta name="twitter:description" content="${desc}"`);

  // Replace Canonical Link
  html = html.replace(/<link rel="canonical" href="[^"]*"/g, `<link rel="canonical" href="${url}"`);

  // Define target output directory
  const targetDirName = urlPath.replace(/^\//, '');
  const targetDir = path.join(DIST_DIR, targetDirName);
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf-8');
  console.log(`- Created ${targetDirName}/index.html with updated SEO tags`);
});

console.log('Prerendering completed successfully!');
