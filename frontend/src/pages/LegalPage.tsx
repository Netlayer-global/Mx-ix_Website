import React, { useEffect, useState } from 'react';

export interface LegalSection {
  id: string;
  heading: string;
  /** Paragraphs and optional bullet lists. */
  body: Array<string | { list: string[] }>;
}

interface LegalPageProps {
  tag: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  onNavigate?: (page: string) => void;
}

/**
 * Shared presentational layout for legal/policy pages (Privacy, Terms).
 * Swiss white+ink style: ink hero, sticky TOC sidebar with scrollspy, sections.
 */
const LegalPage: React.FC<LegalPageProps> = ({ tag, title, updated, intro, sections, onNavigate }) => {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: '-25% 0px -65% 0px' }
    );
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [sections]);

  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top - document.body.getBoundingClientRect().top - 110;
    window.scrollTo({ top, behavior: 'smooth' });
    window.history.pushState(null, '', `#${id}`);
  };

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Hero */}
      <section className="relative bg-ink text-white overflow-hidden pt-36 md:pt-44 pb-16">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]" />
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 relative z-10">
          <span className="eyebrow">{tag}</span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.95] mt-4 mb-5">{title}</h1>
          <p className="text-gray-500 text-base md:text-lg leading-relaxed max-w-2xl border-l-2 border-white/10 pl-6">{intro}</p>
          <p className="font-mono text-label-sm tracking-label uppercase text-gray-500 mt-6">Last updated · {updated}</p>
        </div>
      </section>

      {/* Body */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-12 py-14 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* TOC */}
          <aside className="lg:col-span-3">
            <div className="sticky top-28 space-y-1">
              <div className="font-mono text-label-sm tracking-label uppercase text-gray-500 mb-3 px-4">Contents</div>
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => scrollTo(e, s.id)}
                  className={`block font-mono text-label-sm tracking-mono uppercase py-2 border-l-2 pl-4 transition-colors hover-trigger ${
                    active === s.id ? 'border-[#F20732] text-ink font-bold' : 'border-gray-200 text-gray-500 hover:text-ink hover:border-gray-400'
                  }`}
                >
                  {s.heading}
                </a>
              ))}
            </div>
          </aside>

          {/* Content */}
          <div className="lg:col-span-9 space-y-12">
            {sections.map((s, i) => (
              <div key={s.id} id={s.id} className="scroll-mt-28">
                <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-ink mb-4 flex items-baseline gap-3">
                  <span className="font-mono text-sm text-[#F20732]">{String(i + 1).padStart(2, '0')}</span>
                  {s.heading}
                </h2>
                <div className="space-y-4">
                  {s.body.map((b, j) =>
                    typeof b === 'string' ? (
                      <p key={j} className="text-gray-600 leading-relaxed">{b}</p>
                    ) : (
                      <ul key={j} className="space-y-2">
                        {b.list.map((li, k) => (
                          <li key={k} className="flex items-start gap-3 text-gray-600 leading-relaxed">
                            <span className="w-1.5 h-1.5 bg-[#F20732] mt-2 flex-shrink-0" />
                            <span>{li}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              </div>
            ))}

            {/* Contact note */}
            <div className="border-l-2 border-[#F20732] bg-gray-50 p-6">
              <p className="text-sm text-gray-600 leading-relaxed">
                Questions about this document? Email{' '}
                <a href="mailto:legal@mx-ix.com" className="text-ink font-bold hover:text-[#F20732] transition-colors hover-trigger">legal@mx-ix.com</a>
                {onNavigate && (
                  <>
                    {' '}or{' '}
                    <button onClick={() => onNavigate('contact')} className="text-ink font-bold hover:text-[#F20732] transition-colors hover-trigger">contact our team</button>
                  </>
                )}.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LegalPage;
