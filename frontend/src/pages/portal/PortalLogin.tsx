import React, { useState, useEffect } from 'react';
import { LogIn, ArrowRight, ArrowLeft, Loader2, CheckCircle2, KeyRound } from 'lucide-react';
import { portalApi, PortalUserInfo, PortalOrgInfo } from '../../services/api';

interface Props {
  onAuthenticated: (user: PortalUserInfo, org: PortalOrgInfo) => void;
  onNavigate?: (page: string) => void;
}

const ORG_TYPES = ['ISP', 'Content', 'Cloud', 'CDN', 'Enterprise', 'Academic', 'Other'];

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

const PortalLogin: React.FC<Props> = ({ onAuthenticated, onNavigate }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signupDone, setSignupDone] = useState(false);
  const [notice, setNotice] = useState('');

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [totp, setTotp] = useState('');

  // Reset fields
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Signup fields
  const [companyName, setCompanyName] = useState('');
  const [asn, setAsn] = useState('');
  const [website, setWebsite] = useState('');
  const [type, setType] = useState('ISP');
  const [contactName, setContactName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Detect a password-reset link (?reset=<token>)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset');
    if (token) {
      setResetToken(token);
      setMode('reset');
    }
  }, []);

  const inputClass =
    'w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#F20732] transition-colors';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await portalApi.login(email.trim(), password, needs2fa ? totp.trim() : undefined);
    setLoading(false);
    if (res.success && res.data) {
      onAuthenticated(res.data.user, res.data.organization);
    } else if ((res as any).twoFactorRequired) {
      setNeeds2fa(true);
      setError(needs2fa ? res.error || 'Invalid code.' : '');
    } else {
      setError(res.error || 'Login failed.');
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await portalApi.forgotPassword(email.trim());
    setLoading(false);
    if (res.success) {
      setNotice(res.message || 'If an account exists, a reset link has been sent.');
      setMode('login');
    } else {
      setError(res.error || 'Failed to send reset link.');
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    const res = await portalApi.resetPassword(resetToken, newPassword);
    setLoading(false);
    if (res.success) {
      window.history.replaceState({}, '', '/portal');
      setNotice('Password reset. You can now sign in.');
      setNewPassword('');
      setConfirmPassword('');
      setMode('login');
    } else {
      setError(res.error || 'Failed to reset password.');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    const res = await portalApi.signup({
      companyName: companyName.trim(),
      asn: asn.trim() || undefined,
      website: website.trim() || undefined,
      type,
      contactName: contactName.trim(),
      email: signupEmail.trim(),
      password: signupPassword,
    });
    setLoading(false);
    if (res.success) {
      setSignupDone(true);
    } else {
      setError(res.error || 'Signup failed.');
    }
  };

  return (
    <div className="min-h-screen bg-ink text-white relative overflow-hidden flex items-center justify-center px-6 py-20">
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]"></div>
      <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#F20732]/10 blur-[120px]"></div>

      <button
        onClick={() => onNavigate?.('home')}
        className="absolute top-6 left-6 inline-flex items-center gap-2 font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-white transition-colors hover-trigger"
      >
        <ArrowLeft className="w-4 h-4" /> MX-IX
      </button>

      <div className="relative w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <LogIn className="w-4 h-4 text-[#F20732]" />
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Member Portal</span>
        </div>

        {notice && (
          <div className="mb-6 border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {notice}
          </div>
        )}

        {signupDone ? (
          <div className="border border-white/10 bg-white/[0.03] p-8">
            <CheckCircle2 className="w-10 h-10 text-green-500 mb-4" />
            <h1 className="text-3xl font-black tracking-tighter leading-[0.95] mb-3">REQUEST RECEIVED</h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Your account has been created and is pending approval. An MX-IX administrator will review
              your network details and activate access shortly. You'll be able to sign in once approved.
            </p>
            <button
              onClick={() => {
                setSignupDone(false);
                setMode('login');
              }}
              className="inline-flex items-center gap-2 font-mono text-label-sm font-bold tracking-mono uppercase text-white hover:text-[#F20732] transition-colors hover-trigger"
            >
              Back to sign in <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : mode === 'login' ? (
          <>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-[0.95] mb-4">
              MEMBER <span className="text-[#F20732]">LOGIN</span>
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">
              Manage your ports, peering sessions, traffic and account on the MX-IX fabric.
            </p>

            <form className="space-y-3" onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="you@network.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
              />

              {needs2fa && (
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit authenticator code"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                  autoFocus
                  className={`${inputClass} tracking-[0.3em] text-center`}
                />
              )}

              {error && <p className="text-[#F20732] font-mono text-xs">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F20732] text-white px-6 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors disabled:opacity-60 flex items-center justify-center gap-2 hover-trigger"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : needs2fa ? 'Verify & Sign In' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10 text-sm text-gray-400 flex items-center justify-between flex-wrap gap-2">
              <span>
                New to MX-IX?{' '}
                <button
                  onClick={() => {
                    setError('');
                    setNotice('');
                    setMode('signup');
                  }}
                  className="font-mono text-label-sm font-bold tracking-mono uppercase text-white hover:text-[#F20732] transition-colors hover-trigger"
                >
                  Request access
                </button>
              </span>
              <button
                onClick={() => {
                  setError('');
                  setNotice('');
                  setMode('forgot');
                }}
                className="font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-[#F20732] transition-colors hover-trigger"
              >
                Forgot password?
              </button>
            </div>
          </>
        ) : mode === 'signup' ? (
          <>
            <h1 className="text-4xl font-black tracking-tighter leading-[0.95] mb-4">
              REQUEST <span className="text-[#F20732]">ACCESS</span>
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">
              Tell us about your network. Accounts are reviewed and approved by the MX-IX team.
            </p>

            <form className="space-y-3" onSubmit={handleSignup}>
              <input
                type="text"
                placeholder="Network / company name *"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="ASN (e.g. 15169)"
                  value={asn}
                  onChange={(e) => setAsn(e.target.value)}
                  className={inputClass}
                />
                <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                  {ORG_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-ink">
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="url"
                placeholder="Website (optional)"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className={inputClass}
              />
              <div className="h-px bg-white/10 my-1" />
              <input
                type="text"
                placeholder="Your name *"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                className={inputClass}
              />
              <input
                type="email"
                placeholder="Work email *"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
                className={inputClass}
              />
              <input
                type="password"
                placeholder="Password (min 8 chars) *"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
                className={inputClass}
              />

              {error && <p className="text-[#F20732] font-mono text-xs">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F20732] text-white px-6 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors disabled:opacity-60 flex items-center justify-center gap-2 hover-trigger"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Request'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10 text-sm text-gray-400">
              Already have an account?{' '}
              <button
                onClick={() => {
                  setError('');
                  setMode('login');
                }}
                className="font-mono text-label-sm font-bold tracking-mono uppercase text-white hover:text-[#F20732] transition-colors hover-trigger"
              >
                Sign in
              </button>
            </div>
          </>
        ) : mode === 'forgot' ? (
          <>
            <h1 className="text-4xl font-black tracking-tighter leading-[0.95] mb-4">
              RESET <span className="text-[#F20732]">PASSWORD</span>
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <form className="space-y-3" onSubmit={handleForgot}>
              <input
                type="email"
                placeholder="you@network.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
              {error && <p className="text-[#F20732] font-mono text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F20732] text-white px-6 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors disabled:opacity-60 flex items-center justify-center gap-2 hover-trigger"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
              </button>
            </form>
            <button
              onClick={() => {
                setError('');
                setMode('login');
              }}
              className="mt-6 inline-flex items-center gap-2 font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-white transition-colors hover-trigger"
            >
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="w-5 h-5 text-[#F20732]" />
              <h1 className="text-3xl font-black tracking-tighter leading-[0.95]">NEW PASSWORD</h1>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">
              Choose a new password for your MX-IX portal account.
            </p>
            <form className="space-y-3" onSubmit={handleReset}>
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
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F20732] text-white px-6 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors disabled:opacity-60 flex items-center justify-center gap-2 hover-trigger"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set New Password'}
              </button>
            </form>
            <button
              onClick={() => {
                setError('');
                window.history.replaceState({}, '', '/portal');
                setMode('login');
              }}
              className="mt-6 inline-flex items-center gap-2 font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-white transition-colors hover-trigger"
            >
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PortalLogin;
