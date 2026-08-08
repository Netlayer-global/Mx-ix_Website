import mongoose, { Document, Schema, Types } from 'mongoose';
import crypto from 'crypto';

/**
 * API Token — a long-lived bearer token for automation / API access.
 *
 * Separate from the JWT session: these don't expire on their own (unless
 * expiresAt is set), survive password changes, and can be scoped to read-only.
 * Think of them like GitHub personal access tokens.
 *
 * The token value is stored hashed (SHA-256) — the plain-text version is only
 * shown ONCE at creation time. This means a leaked database doesn't expose
 * usable credentials.
 */
export interface IApiToken extends Document {
  /** The user who created this token (admin User._id or PortalUser._id). */
  user: Types.ObjectId;
  /** Which auth realm this token belongs to. */
  realm: 'admin' | 'portal';
  /** Human-readable label, e.g. "Ansible automation" or "Grafana datasource". */
  name: string;
  /** SHA-256 hash of the token. The plain text is never stored. */
  tokenHash: string;
  /** First 8 chars of the token for identification in lists (like GitHub). */
  prefix: string;
  /** Scope: 'full' = same as the user's role, 'readonly' = GET only. */
  scope: 'full' | 'readonly';
  /** Optional expiry. Null = never expires (until revoked). */
  expiresAt?: Date | null;
  lastUsedAt?: Date | null;
  lastUsedIp?: string;
  revoked: boolean;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const apiTokenSchema = new Schema<IApiToken>(
  {
    user: { type: Schema.Types.ObjectId, required: true, index: true },
    realm: { type: String, enum: ['admin', 'portal'], required: true },
    name: { type: String, required: true, trim: true },
    tokenHash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true },
    scope: { type: String, enum: ['full', 'readonly'], default: 'full' },
    expiresAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
    lastUsedIp: { type: String, default: '' },
    revoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

apiTokenSchema.index({ tokenHash: 1 });
apiTokenSchema.index({ user: 1, revoked: 1 });

/**
 * Generate a new random token.
 * Returns { plain, hash, prefix } — the plain text is shown to the user
 * exactly once, then only the hash is kept.
 */
export const generateToken = (): { plain: string; hash: string; prefix: string } => {
  const plain = `mxix_${crypto.randomBytes(32).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(plain).digest('hex');
  const prefix = plain.slice(0, 12);
  return { plain, hash, prefix };
};

/** Hash a plain token for lookup. */
export const hashToken = (plain: string): string =>
  crypto.createHash('sha256').update(plain).digest('hex');

export const ApiToken = mongoose.model<IApiToken>('ApiToken', apiTokenSchema);
export default ApiToken;
