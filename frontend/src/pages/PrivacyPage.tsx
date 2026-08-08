import React from 'react';
import LegalPage, { LegalSection } from './LegalPage';

interface Props { onNavigate?: (page: string) => void }

const SECTIONS: LegalSection[] = [
  {
    id: 'overview',
    heading: 'Overview',
    body: [
      'MX-IX Digital Infrastructure Pvt. Ltd. ("MX-IX", "we", "us") operates a carrier-neutral Internet Exchange and this website. This Privacy Policy explains what personal data we collect, how we use it, and the rights you have over it.',
      'We are committed to handling your data lawfully, transparently and securely. This policy applies to members, prospective members and visitors to our website.',
    ],
  },
  {
    id: 'data-we-collect',
    heading: 'Data We Collect',
    body: [
      'We collect only the data we need to provide and operate our services:',
      { list: [
        'Contact details you provide — name, work email, phone number and company.',
        'Network details — ASN, peering policy, requested locations and port speeds.',
        'Account data for the member portal — login email and securely hashed password.',
        'Operational data — support tickets, orders, and communications with our team.',
        'Technical data — IP address, browser type and basic usage analytics for the website.',
      ] },
    ],
  },
  {
    id: 'how-we-use',
    heading: 'How We Use Your Data',
    body: [
      'We use your data to:',
      { list: [
        'Process membership applications, port requests and orders.',
        'Provide, operate and support the exchange and the member portal.',
        'Communicate service updates, maintenance, incidents and (with consent) relevant information.',
        'Maintain the security, integrity and performance of the fabric.',
        'Meet our legal, regulatory and contractual obligations.',
      ] },
    ],
  },
  {
    id: 'legal-basis',
    heading: 'Legal Basis',
    body: [
      'We process personal data on the basis of: performance of a contract (providing services you request), our legitimate interests (operating and securing the exchange), your consent (optional marketing communications), and compliance with legal obligations.',
      'You may withdraw consent for optional communications at any time without affecting the lawfulness of prior processing.',
    ],
  },
  {
    id: 'sharing',
    heading: 'Sharing & Disclosure',
    body: [
      'We do not sell your personal data. We share it only where necessary:',
      { list: [
        'Service providers acting on our behalf (e.g. email, billing, monitoring) under contract.',
        'Data centers and connectivity partners to provision your requested services.',
        'Authorities where required by law or to protect our rights and the security of the fabric.',
      ] },
    ],
  },
  {
    id: 'retention',
    heading: 'Data Retention',
    body: [
      'We retain personal data only for as long as necessary for the purposes described in this policy, to comply with legal obligations, resolve disputes and enforce agreements. When no longer required, data is securely deleted or anonymised.',
    ],
  },
  {
    id: 'security',
    heading: 'Security',
    body: [
      'We apply appropriate technical and organisational measures to protect your data, including encryption in transit, hashed credentials, access controls and monitoring. No method of transmission or storage is completely secure, but we work continuously to protect your information.',
    ],
  },
  {
    id: 'your-rights',
    heading: 'Your Rights',
    body: [
      'Subject to applicable law, you have the right to access, correct, delete or restrict the processing of your personal data, to object to processing, and to data portability. To exercise these rights, contact us using the details below.',
    ],
  },
  {
    id: 'cookies',
    heading: 'Cookies & Analytics',
    body: [
      'Our website uses essential cookies for core functionality and limited analytics to understand usage and improve the experience. You can control cookies through your browser settings; disabling some may affect site functionality.',
    ],
  },
  {
    id: 'international',
    heading: 'International Transfers',
    body: [
      'Where data is transferred outside your jurisdiction, we ensure appropriate safeguards are in place consistent with applicable data-protection law.',
    ],
  },
  {
    id: 'changes',
    heading: 'Changes to This Policy',
    body: [
      'We may update this policy from time to time. Material changes will be reflected by an updated effective date and, where appropriate, communicated directly. Continued use of our services after changes constitutes acceptance of the revised policy.',
    ],
  },
];

const PrivacyPage: React.FC<Props> = ({ onNavigate }) => (
  <LegalPage
    tag="Legal"
    title="Privacy Policy"
    updated="June 2026"
    intro="How MX-IX collects, uses, shares and protects your personal data when you use our website and services."
    sections={SECTIONS}
    onNavigate={onNavigate}
  />
);

export default PrivacyPage;
