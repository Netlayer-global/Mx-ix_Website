import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import Reveal from './Reveal';

const FAQS = [
  {
    q: 'What is an Internet Exchange (IXP)?',
    a: 'An IXP is neutral infrastructure where networks — ISPs, content providers, cloud platforms and enterprises — interconnect to exchange traffic directly, instead of routing it through third-party transit providers. This lowers latency, reduces cost and improves resilience.',
  },
  {
    q: 'How do I connect to MX-IX?',
    a: 'Order a port (1G–400G) at one of our locations, cross-connect to our switching fabric in the data center, then configure a BGP session to our route servers. Our team guides you through the whole process — usually live within days.',
  },
  {
    q: 'What is the difference between public and private peering?',
    a: 'Public peering uses our route servers — one BGP session connects you to many networks at once. Private peering (PNI) is a dedicated interconnect between two networks for high-volume traffic. MX-IX supports both.',
  },
  {
    q: 'Do you charge for traffic?',
    a: 'No. MX-IX pricing is per-port and unmetered — exchange as much traffic as you like. A single port unlocks the entire peering ecosystem with no per-megabit charges.',
  },
  {
    q: 'Is MX-IX carrier and data-center neutral?',
    a: 'Yes. We are fully neutral by design. Every network connects on equal terms and is free to peer with whomever it chooses, across multiple data centers.',
  },
  {
    q: 'How do route servers and prefix filtering work?',
    a: 'Our redundant route servers handle multilateral peering and apply IRR/RPKI-based filtering to keep the routing table clean and secure. You can inspect sessions and routes live via our Looking Glass.',
  },
];

const FAQ: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="relative bg-white py-20 md:py-28 border-b border-gray-200 z-10">
      <div className="max-w-[1000px] mx-auto px-6 md:px-12">
        <Reveal className="mb-12">
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732] mb-4 block">// Peering 101</span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.95] text-black">
            FREQUENTLY ASKED
          </h2>
        </Reveal>

        <div className="border-t border-gray-200">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="border-b border-gray-200">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-5 text-left hover-trigger group"
                >
                  <span className={`font-bold tracking-tight text-lg transition-colors ${isOpen ? 'text-[#F20732]' : 'text-black group-hover:text-[#F20732]'}`}>
                    {item.q}
                  </span>
                  {isOpen ? <Minus className="w-5 h-5 text-[#F20732] flex-shrink-0" /> : <Plus className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 pb-6' : 'max-h-0'}`}>
                  <p className="text-gray-500 leading-relaxed pr-8">{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
