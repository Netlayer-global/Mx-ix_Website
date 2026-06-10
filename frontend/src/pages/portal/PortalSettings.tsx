import React, { useState } from 'react';
import { Loader2, Lock, Building2, CheckCircle2, ShieldCheck, Smartphone } from 'lucide-react';
import { portalApi, PortalUserInfo, PortalOrgInfo } from '../../services/api';
import { PageHeading, Badge } from './ui';

interface Props {
  user: PortalUserInfo;
  org: PortalOrgInfo;
  onOrgRefresh?: (org: PortalOrgInfo) => void;
}

const PortalSettings: React.FC<Props> = ({ user, org }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const inputClass =
    'w-full bg-white border border-gray-300 text-ink placeholder-gray-400 px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#F20732] transition-colors';

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDone(false);
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    const res = await portalApi.changePassword(currentPassword, newPassword);
    setSaving(false);
    if (res.success) {
      setDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setError(res.error || 'Failed to change password.');
    }
  };

  const allAsns = [org.asn, ...(org.additionalAsns || [])].filter(Boolean) as number[];

  const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 last:border-0">
      <span className="font-mono text-label-sm tracking-label uppercase text-gray-400">{label}</span>
      <span className="text-sm text-ink text-right">{value || '—'}</span>
    </div>
  );

  return (
    <div>
      <PageHeading
        eyebrow="// Account"
        title="Settings"
        subtitle="Your organization profile and account security. To update network details, contact MX-IX."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organization profile */}
        <section className="bg-white border border-gray-200">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
            <Building2 className="w-4 h-4 text-[#F20732]" />
            <h3 className="font-mono text-label tracking-label uppercase text-ink">Organization</h3>
          </div>
          <Row label="Name" value={org.name} />
          <Row label="Type" value={org.type} />
          <Row
            label="Status"
            value={
              <Badge tone={org.status === 'active' ? 'green' : org.status === 'suspended' ? 'red' : 'amber'}>
                {org.status}
              </Badge>
            }
          />
          <Row label="Peering Policy" value={org.peeringPolicy} />
          <Row label="ASNs" value={allAsns.length ? allAsns.map((a) => `AS${a}`).join(', ') : '—'} />
          <Row
            label="Website"
            value={
              org.website ? (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#F20732] hover:underline break-all"
                >
                  {org.website}
                </a>
              ) : (
                '—'
              )
            }
          />
          <Row label="NOC Email" value={org.nocEmail} />
          <Row label="NOC Phone" value={org.nocPhone} />
        </section>

        {/* Account + password */}
        <div className="space-y-6">
          <section className="bg-white border border-gray-200">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
              <h3 className="font-mono text-label tracking-label uppercase text-ink">Your Account</h3>
            </div>
            <Row label="Name" value={user.name} />
            <Row label="Email" value={user.email} />
            <Row label="Role" value={<Badge tone="gray">{user.role}</Badge>} />
          </section>

          <section className="bg-white border border-gray-200">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
              <Lock className="w-4 h-4 text-[#F20732]" />
              <h3 className="font-mono text-label tracking-label uppercase text-ink">Change Password</h3>
            </div>
            <form className="p-5 space-y-3" onSubmit={changePassword}>
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className={inputClass}
              />
              <input
                type="password"
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className={inputClass}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={inputClass}
              />

              {error && <p className="text-[#F20732] font-mono text-xs">{error}</p>}
              {done && (
                <p className="text-green-600 font-mono text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Password updated.
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="bg-[#F20732] text-white px-6 py-3 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-ink transition-colors disabled:opacity-60 flex items-center justify-center gap-2 hover-trigger"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
              </button>
            </form>
          </section>

          <TwoFactorCard enabled={!!user.twoFactorEnabled} inputClass={inputClass} />
        </div>
      </div>
    </div>
  );
};

// ── Two-factor authentication card ─────────────────────────────────────────

const TwoFactorCard: React.FC<{ enabled: boolean; inputClass: string }> = ({ enabled: initialEnabled, inputClass }) => {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<'idle' | 'setup'>('idle');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const startSetup = async () => {
    setBusy(true);
    setError('');
    const res = await portalApi.setup2fa();
    setBusy(false);
    if (res.success && res.data) {
      setQr(res.data.qr);
      setSecret(res.data.secret);
      setStep('setup');
    } else {
      setError(res.error || 'Failed to start setup.');
    }
  };

  const confirmEnable = async () => {
    setBusy(true);
    setError('');
    const res = await portalApi.enable2fa(code.trim());
    setBusy(false);
    if (res.success) {
      setEnabled(true);
      setStep('idle');
      setCode('');
      setQr('');
    } else {
      setError(res.error || 'Invalid code.');
    }
  };

  const disable = async () => {
    setBusy(true);
    setError('');
    const res = await portalApi.disable2fa(password);
    setBusy(false);
    if (res.success) {
      setEnabled(false);
      setPassword('');
    } else {
      setError(res.error || 'Failed to disable.');
    }
  };

  return (
    <section className="bg-white border border-gray-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#F20732]" />
          <h3 className="font-mono text-label tracking-label uppercase text-ink">Two-Factor Auth</h3>
        </div>
        <Badge tone={enabled ? 'green' : 'gray'}>{enabled ? 'Enabled' : 'Off'}</Badge>
      </div>

      <div className="p-5">
        {enabled ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-gray-400" /> Your account is protected with an authenticator app.
            </p>
            <input
              type="password"
              placeholder="Confirm password to disable"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            {error && <p className="text-[#F20732] font-mono text-xs">{error}</p>}
            <button
              onClick={disable}
              disabled={busy || !password}
              className="border border-gray-300 px-5 py-3 font-mono text-label-sm font-bold tracking-mono uppercase hover:border-[#F20732] hover:text-[#F20732] transition-colors disabled:opacity-50 flex items-center gap-2 hover-trigger"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disable 2FA'}
            </button>
          </div>
        ) : step === 'idle' ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Add a second layer of security with a TOTP authenticator app (Google Authenticator, Authy, 1Password).
            </p>
            <button
              onClick={startSetup}
              disabled={busy}
              className="bg-[#F20732] text-white px-5 py-3 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-ink transition-colors disabled:opacity-60 flex items-center gap-2 hover-trigger"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable 2FA'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Scan this QR code with your authenticator app, then enter the 6-digit code.</p>
            {qr && <img src={qr} alt="2FA QR code" className="w-44 h-44 border border-gray-200" />}
            <p className="font-mono text-xs text-gray-400 break-all">
              Manual key: <span className="text-ink">{secret}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} tracking-[0.3em] text-center max-w-[200px]`}
            />
            {error && <p className="text-[#F20732] font-mono text-xs">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={confirmEnable}
                disabled={busy || code.length < 6}
                className="bg-[#F20732] text-white px-5 py-3 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-ink transition-colors disabled:opacity-50 flex items-center gap-2 hover-trigger"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Enable'}
              </button>
              <button
                onClick={() => {
                  setStep('idle');
                  setError('');
                  setCode('');
                }}
                className="font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-ink transition-colors hover-trigger"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PortalSettings;