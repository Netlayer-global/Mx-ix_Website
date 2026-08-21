import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  Loader2,
  Megaphone,
  Save,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowRight,
  X,
  Sparkles,
} from 'lucide-react';
import { sitePromoApi, SitePromo } from '../services/api';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

const MAX_IMAGE_BYTES = 5_000_000;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const EMPTY: SitePromo = {
  banner: { enabled: false, message: '', linkLabel: '', linkUrl: '', tone: 'red', dismissible: true },
  popup: {
    enabled: false,
    eyebrow: '',
    title: '',
    body: '',
    ctaLabel: '',
    ctaUrl: '',
    secondaryLabel: '',
    secondaryUrl: '',
    imageUrl: '',
    imageFit: 'contain',
    hasUpload: false,
  },
  revision: 1,
};

/** One-click starting point for the Kolkata IX announcement. */
const KOLKATA_PRESET = {
  banner: {
    message: 'MX-IX has acquired Kolkata IX — expanding our peering footprint across eastern India.',
    linkLabel: 'Read the announcement',
    linkUrl: '/content-fabric',
  },
  popup: {
    eyebrow: 'Announcement',
    title: 'MX-IX acquires Kolkata IX',
    body:
      'We have acquired Kolkata IX, bringing its peering community onto the MX-IX fabric.\n\n' +
      'Members gain access to a larger interconnection ecosystem across eastern India, with the same flat ' +
      'port pricing, RPKI-filtered route servers and 24/7 NOC support.',
    ctaLabel: 'Talk to our team',
    ctaUrl: '/contact',
    secondaryLabel: 'Explore the Locations',
    secondaryUrl: '/locations',
  },
};

const SitePromoAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [promo, setPromo] = useState<SitePromo>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  /** Pending upload (data URL) not yet saved. */
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const res = await sitePromoApi.getAdmin();
    if (res.success && res.data) setPromo(res.data);
    else setError(res.error || 'Failed to load the announcement.');
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setBanner = (patch: Partial<SitePromo['banner']>) =>
    setPromo((p) => ({ ...p, banner: { ...p.banner, ...patch } }));
  const setPopup = (patch: Partial<SitePromo['popup']>) =>
    setPromo((p) => ({ ...p, popup: { ...p.popup, ...patch } }));

  const pickFile = (file: File) => {
    setError('');
    if (!ALLOWED.includes(file.type)) {
      setError('Unsupported image type. Use PNG, JPEG, WebP or GIF.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(
        `Image is ${(file.size / 1_000_000).toFixed(2)} MB. Maximum is ${MAX_IMAGE_BYTES / 1_000_000} MB.`
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage(String(reader.result));
      setRemoveImage(false);
    };
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsDataURL(file);
  };

  const save = async (opts: { bumpRevision?: boolean } = {}) => {
    setSaving(true);
    setError('');
    setDone('');
    const res = await sitePromoApi.update({
      banner: promo.banner,
      popup: {
        enabled: promo.popup.enabled,
        eyebrow: promo.popup.eyebrow,
        title: promo.popup.title,
        body: promo.popup.body,
        ctaLabel: promo.popup.ctaLabel,
        ctaUrl: promo.popup.ctaUrl,
        secondaryLabel: promo.popup.secondaryLabel,
        secondaryUrl: promo.popup.secondaryUrl,
        imageUrl: promo.popup.imageUrl,
        imageFit: promo.popup.imageFit,
      },
      ...(pendingImage ? { imageBase64: pendingImage } : {}),
      ...(removeImage ? { removeImage: true } : {}),
      ...(opts.bumpRevision ? { bumpRevision: true } : {}),
    });
    setSaving(false);
    if (res.success && res.data) {
      setPromo(res.data);
      setPendingImage(null);
      setRemoveImage(false);
      setDone(
        opts.bumpRevision
          ? 'Saved. Everyone will see the announcement again, including visitors who dismissed it.'
          : 'Saved and live.'
      );
      setTimeout(() => setDone(''), 6000);
    } else {
      setError(res.error || 'Failed to save.');
    }
  };

  const applyPreset = () => {
    setBanner({ ...KOLKATA_PRESET.banner });
    setPopup({ ...KOLKATA_PRESET.popup });
    setDone('Kolkata IX text filled in. Review it, then Save.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F20732]" />
      </div>
    );
  }

  const field = 'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm';
  const label = 'block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5';
  const previewImage = pendingImage || (removeImage ? '' : promo.popup.imageUrl);

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          {embedded && onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Site Announcement</h1>
              <p className="text-gray-400 text-sm">Headline bar + entry popup on the public website</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={applyPreset}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded font-bold text-sm hover:bg-gray-600"
            >
              <Sparkles className="w-4 h-4" /> Fill Kolkata IX text
            </button>
            <button
              onClick={() => save()}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {error && <p className="bg-[#F20732]/10 border border-[#F20732]/40 text-[#F20732] rounded p-3 text-sm">{error}</p>}
        {done && <p className="bg-green-500/10 border border-green-500/40 text-green-400 rounded p-3 text-sm">{done}</p>}

        {/* Live status + re-show control */}
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <div className="flex flex-wrap items-center gap-4">
            <StatusPill on={promo.banner.enabled} label="Headline bar" />
            <StatusPill on={promo.popup.enabled} label="Entry popup" />
            <span className="text-xs text-gray-500 font-mono">revision {promo.revision}</span>
            <button
              onClick={() => save({ bumpRevision: true })}
              disabled={saving}
              className="ml-auto flex items-center gap-2 px-4 py-2 border border-gray-600 rounded text-sm hover:border-gray-400 disabled:opacity-50"
              title="Save and re-show to visitors who already dismissed or closed it"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Save &amp; show again
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3 leading-relaxed">
            Each surface switches on and off independently, so you can write everything now and flip it live on
            Monday. Turning something off hides it immediately and keeps the text for next time.
          </p>
        </section>

        {/* ── Headline bar ── */}
        <section className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-700">
            <div>
              <h2 className="font-bold">Headline bar</h2>
              <p className="text-xs text-gray-500">Thin strip pinned above the navigation on every public page</p>
            </div>
            <Toggle on={promo.banner.enabled} onChange={(v) => setBanner({ enabled: v })} label="headline bar" />
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className={label} htmlFor="promo-banner-message">Message</label>
              <input
                id="promo-banner-message"
                value={promo.banner.message}
                onChange={(e) => setBanner({ message: e.target.value })}
                maxLength={300}
                placeholder="MX-IX has acquired Kolkata IX — expanding our peering footprint across eastern India."
                className={field}
              />
              <p className="text-[11px] text-gray-500 mt-1">{promo.banner.message.length}/300</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={label} htmlFor="promo-banner-link-label">Link label</label>
                <input
                  id="promo-banner-link-label"
                  value={promo.banner.linkLabel}
                  onChange={(e) => setBanner({ linkLabel: e.target.value })}
                  placeholder="Read the announcement"
                  className={field}
                />
              </div>
              <div>
                <label className={label} htmlFor="promo-banner-link-url">Link URL</label>
                <input
                  id="promo-banner-link-url"
                  value={promo.banner.linkUrl}
                  onChange={(e) => setBanner({ linkUrl: e.target.value })}
                  placeholder="/content-fabric or https://…"
                  className={field}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <div>
                <label className={label} htmlFor="promo-banner-tone">Colour</label>
                <select
                  id="promo-banner-tone"
                  value={promo.banner.tone}
                  onChange={(e) => setBanner({ tone: e.target.value as 'red' | 'ink' })}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                >
                  <option value="red">Brand red</option>
                  <option value="ink">Ink (near-black)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm mt-5">
                <input
                  type="checkbox"
                  checked={promo.banner.dismissible}
                  onChange={(e) => setBanner({ dismissible: e.target.checked })}
                />
                Visitors can dismiss it
              </label>
            </div>

            {/* Preview */}
            <div>
              <p className={label}>Preview</p>
              <div
                className={`flex items-center justify-center gap-2 rounded px-8 py-2.5 text-white ${
                  promo.banner.tone === 'ink' ? 'bg-[#0A0A0B]' : 'bg-[#F20732]'
                }`}
              >
                <Megaphone className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs font-bold text-center">
                  {promo.banner.message || 'Your message will appear here'}
                  {promo.banner.linkLabel && promo.banner.linkUrl && (
                    <span className="ml-2.5 inline-flex items-center gap-1 underline underline-offset-2">
                      {promo.banner.linkLabel} <ArrowRight className="w-3 h-3" />
                    </span>
                  )}
                </span>
                {promo.banner.dismissible && <X className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />}
              </div>
            </div>
          </div>
        </section>

        {/* ── Entry popup ── */}
        <section className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-700">
            <div>
              <h2 className="font-bold">Entry popup</h2>
              <p className="text-xs text-gray-500">Shown once per visitor when they land on the site</p>
            </div>
            <Toggle on={promo.popup.enabled} onChange={(v) => setPopup({ enabled: v })} label="entry popup" />
          </div>

          <div className="p-5 grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className={label} htmlFor="promo-popup-eyebrow">Eyebrow</label>
                <input
                  id="promo-popup-eyebrow"
                  value={promo.popup.eyebrow}
                  onChange={(e) => setPopup({ eyebrow: e.target.value })}
                  placeholder="Announcement"
                  className={field}
                />
              </div>
              <div>
                <label className={label} htmlFor="promo-popup-title">Title</label>
                <input
                  id="promo-popup-title"
                  value={promo.popup.title}
                  onChange={(e) => setPopup({ title: e.target.value })}
                  placeholder="MX-IX acquires Kolkata IX"
                  className={field}
                />
              </div>
              <div>
                <label className={label} htmlFor="promo-popup-body">Body</label>
                <textarea
                  id="promo-popup-body"
                  value={promo.popup.body}
                  onChange={(e) => setPopup({ body: e.target.value })}
                  rows={6}
                  maxLength={1200}
                  placeholder="What changed, and what it means for members…"
                  className={field}
                />
                <p className="text-[11px] text-gray-500 mt-1">{promo.popup.body.length}/1200 · blank lines are kept</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={label} htmlFor="promo-cta-label">Primary button</label>
                  <input
                    id="promo-cta-label"
                    value={promo.popup.ctaLabel}
                    onChange={(e) => setPopup({ ctaLabel: e.target.value })}
                    placeholder="Talk to our team"
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="promo-cta-url">Primary URL</label>
                  <input
                    id="promo-cta-url"
                    value={promo.popup.ctaUrl}
                    onChange={(e) => setPopup({ ctaUrl: e.target.value })}
                    placeholder="/contact"
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="promo-sec-label">Secondary button</label>
                  <input
                    id="promo-sec-label"
                    value={promo.popup.secondaryLabel}
                    onChange={(e) => setPopup({ secondaryLabel: e.target.value })}
                    placeholder="Explore the Locations"
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="promo-sec-url">Secondary URL</label>
                  <input
                    id="promo-sec-url"
                    value={promo.popup.secondaryUrl}
                    onChange={(e) => setPopup({ secondaryUrl: e.target.value })}
                    placeholder="/locations"
                    className={field}
                  />
                </div>
              </div>

              {/* Image */}
              <div>
                <p className={label}>Banner image</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ALLOWED.join(',')}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) pickFile(f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded text-sm font-bold hover:bg-gray-600"
                  >
                    <Upload className="w-4 h-4" /> Upload image
                  </button>
                  {(promo.popup.hasUpload || pendingImage) && !removeImage && (
                    <button
                      onClick={() => {
                        setPendingImage(null);
                        setRemoveImage(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-600 rounded text-sm hover:border-[#F20732] hover:text-[#F20732]"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                  {pendingImage && <span className="text-xs text-amber-400">New image ready — press Save</span>}
                  {removeImage && <span className="text-xs text-amber-400">Image will be removed on Save</span>}
                </div>
                <p className="text-[11px] text-gray-500 mt-2">PNG, JPEG, WebP or GIF · up to 5 MB</p>

                <div className="mt-3">
                  <label className={label} htmlFor="promo-image-fit">How to show it</label>
                  <select
                    id="promo-image-fit"
                    value={promo.popup.imageFit}
                    onChange={(e) => setPopup({ imageFit: e.target.value as 'contain' | 'cover' })}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                  >
                    <option value="contain">Whole image, never cropped (designed banner)</option>
                    <option value="cover">Fill a band, may crop edges (photo)</option>
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {promo.popup.imageFit === 'contain'
                      ? 'Your full artwork is shown — nothing is cut off.'
                      : 'The image fills a fixed band; top and bottom may be trimmed.'}
                  </p>
                </div>

                <div className="mt-3">
                  <label className={label} htmlFor="promo-image-url">…or use an image URL</label>
                  <input
                    id="promo-image-url"
                    value={promo.popup.hasUpload && !removeImage ? '' : promo.popup.imageUrl}
                    onChange={(e) => setPopup({ imageUrl: e.target.value })}
                    disabled={(promo.popup.hasUpload && !removeImage) || !!pendingImage}
                    placeholder="https://…/announcement.jpg"
                    className={`${field} disabled:opacity-50`}
                  />
                  {promo.popup.hasUpload && !removeImage && (
                    <p className="text-[11px] text-gray-500 mt-1">An uploaded image is in use and takes precedence.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Popup preview */}
            <div>
              <p className={label}>Preview</p>
              <div className="rounded-[16px] bg-white text-[#0A0A0B] overflow-hidden shadow-xl">
                {previewImage && (
                  <img
                    src={previewImage}
                    alt=""
                    className={
                      promo.popup.imageFit === 'cover'
                        ? 'w-full max-h-48 object-cover'
                        : 'mx-auto block h-auto w-auto max-w-full max-h-[420px] object-contain'
                    }
                  />
                )}
                <div className="p-6">
                  {promo.popup.eyebrow && (
                    <span className="inline-flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.38em] text-[#0A0A0B]/70">
                      <span className="h-px w-8 bg-[#0A0A0B]/25" />
                      {promo.popup.eyebrow}
                      <span className="h-1.5 w-1.5 rounded-full bg-[#F20732]" />
                    </span>
                  )}
                  <h3 className="text-2xl font-black tracking-[-0.04em] leading-[1.05] mt-4">
                    {promo.popup.title || 'Your headline'}
                  </h3>
                  {promo.popup.body && (
                    <p className="text-sm text-gray-600 leading-7 mt-3 whitespace-pre-line line-clamp-6">
                      {promo.popup.body}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-5">
                    {promo.popup.ctaLabel && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#0A0A0B] text-white px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest">
                        {promo.popup.ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {promo.popup.secondaryLabel && (
                      <span className="inline-flex items-center rounded-full border border-[#0A0A0B]/20 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest">
                        {promo.popup.secondaryLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
                Visitors see this once. After editing the text, use <strong>Save &amp; show again</strong> so people
                who already closed it get the new version.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

const StatusPill: React.FC<{ on: boolean; label: string }> = ({ on, label }) => (
  <span
    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold border ${
      on ? 'bg-green-500/10 border-green-500/40 text-green-400' : 'bg-gray-700/50 border-gray-600 text-gray-400'
    }`}
  >
    {on ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
    {label}: {on ? 'live' : 'off'}
  </span>
);

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string }> = ({ on, onChange, label }) => (
  <button
    role="switch"
    aria-checked={on}
    aria-label={`Turn ${label} ${on ? 'off' : 'on'}`}
    onClick={() => onChange(!on)}
    className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
      on ? 'bg-green-500' : 'bg-gray-600'
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
        on ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

export default SitePromoAdminPanel;
