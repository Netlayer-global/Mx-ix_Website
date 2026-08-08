import React from 'react';
import LegalPage, { LegalSection } from './LegalPage';

interface Props { onNavigate?: (page: string) => void }

const SECTIONS: LegalSection[] = [
  {
    id: 'agreement',
    heading: 'Agreement to Terms',
    body: [
      'These Terms & Conditions ("Terms") govern your access to and use of the MX-IX website, member portal and interconnection services provided by MX-IX Digital Infrastructure Pvt. Ltd. ("MX-IX"). By using our services you agree to these Terms.',
      'If you are entering into these Terms on behalf of an organization, you represent that you have authority to bind that organization.',
    ],
  },
  {
    id: 'definitions',
    heading: 'Definitions',
    body: [
      { list: [
        '"Member" — an organization with an approved account connected to the exchange.',
        '"Port" — a physical or logical connection to the MX-IX switching fabric.',
        '"Route Servers" — MX-IX multilateral peering infrastructure (AS141539).',
        '"Services" — the interconnection, peering and related services we provide.',
      ] },
    ],
  },
  {
    id: 'eligibility',
    heading: 'Eligibility & Accounts',
    body: [
      'Membership is subject to approval. You must provide accurate, current and complete information and keep it up to date. You are responsible for safeguarding your portal credentials and for all activity under your account.',
      'You must hold a valid public ASN and meet the technical requirements published on our website to peer on the fabric.',
    ],
  },
  {
    id: 'acceptable-use',
    heading: 'Acceptable Use',
    body: [
      'You agree to use the Services responsibly and not to:',
      { list: [
        'Announce prefixes you are not authorised to originate, or spoof next-hop addresses.',
        'Disrupt the fabric, other members, or the route servers.',
        'Bypass filtering, security controls or published peering policies.',
        'Use the Services for unlawful, fraudulent or abusive activity.',
      ] },
      'We apply RPKI and IRR filtering and may suspend traffic that threatens the integrity of the fabric.',
    ],
  },
  {
    id: 'service-levels',
    heading: 'Service Availability',
    body: [
      'We operate redundant switching and route servers and target high availability, with a 99.99% uptime objective across the fabric. Planned maintenance will be communicated in advance where practical. Service levels for specific ports are set out in your order or service agreement.',
    ],
  },
  {
    id: 'fees',
    heading: 'Fees & Billing',
    body: [
      'Port and service fees are set out in your order or quote. MX-IX charges a flat port-based fee with no per-bit or traffic charges. Fees are billed in advance unless otherwise agreed and are exclusive of applicable taxes. Late or non-payment may result in suspension of Services.',
    ],
  },
  {
    id: 'ip',
    heading: 'Intellectual Property',
    body: [
      'The website, brand, content and software are owned by MX-IX or its licensors and are protected by applicable laws. You may not copy, modify or redistribute them without permission. You retain ownership of your own network data and content.',
    ],
  },
  {
    id: 'liability',
    heading: 'Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, MX-IX is not liable for indirect, incidental or consequential damages, or for loss of profits, data or goodwill. Our total liability arising out of the Services is limited to the fees paid by you for the affected Service in the preceding twelve months.',
      'The Services are provided on an "as available" basis except as expressly stated in a service agreement.',
    ],
  },
  {
    id: 'termination',
    heading: 'Suspension & Termination',
    body: [
      'Either party may terminate in accordance with the service agreement. We may suspend or terminate access for breach of these Terms, non-payment, or where required to protect the fabric or comply with law. On termination, your right to use the Services ceases and outstanding fees become due.',
    ],
  },
  {
    id: 'governing-law',
    heading: 'Governing Law',
    body: [
      'These Terms are governed by the laws of India, and the courts of Gurugram, Haryana have exclusive jurisdiction, without prejudice to any mandatory consumer protections in your jurisdiction.',
    ],
  },
  {
    id: 'changes',
    heading: 'Changes to These Terms',
    body: [
      'We may update these Terms from time to time. Material changes will be reflected by an updated effective date and, where appropriate, communicated directly. Continued use of the Services after changes constitutes acceptance of the revised Terms.',
    ],
  },
];

const TermsPage: React.FC<Props> = ({ onNavigate }) => (
  <LegalPage
    tag="Legal"
    title="Terms & Conditions"
    updated="June 2026"
    intro="The terms that govern your access to and use of the MX-IX website, member portal and interconnection services."
    sections={SECTIONS}
    onNavigate={onNavigate}
  />
);

export default TermsPage;
