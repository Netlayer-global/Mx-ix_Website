import mongoose, { Document, Schema, Types } from 'mongoose';

export type DeploymentResult = 'success' | 'failed' | 'rolled-back' | 'preview';

/**
 * History of every generated/pushed route-server config.
 *
 * Keeping the full config text per deployment is what makes rollback and
 * "what changed before the session dropped?" answerable. The route servers are
 * the most blast-radius-heavy thing in the fabric, so this trail matters more
 * than the generic AuditLog entry that accompanies it.
 */
export interface IBirdDeployment extends Document {
  routeServer: Types.ObjectId;
  /** SHA-256 of the generated config — lets us skip no-op deploys. */
  configHash: string;
  config: string;
  /** Config that was on disk before this deploy, for rollback. */
  previousConfig?: string;
  result: DeploymentResult;
  /** How it was pushed: local | ssh | agent | manual. */
  method: string;
  /** Number of peer protocol blocks in this build. */
  peerCount: number;
  /** stdout/stderr from the validate + reload commands (truncated). */
  output?: string;
  error?: string;
  actor?: string;
  durationMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

const birdDeploymentSchema = new Schema<IBirdDeployment>(
  {
    routeServer: { type: Schema.Types.ObjectId, ref: 'RouteServer', required: true, index: true },
    configHash: { type: String, default: '' },
    config: { type: String, default: '' },
    previousConfig: { type: String, default: '' },
    result: {
      type: String,
      enum: ['success', 'failed', 'rolled-back', 'preview'],
      default: 'preview',
    },
    method: { type: String, default: 'manual' },
    peerCount: { type: Number, default: 0 },
    output: { type: String, default: '' },
    error: { type: String, default: '' },
    actor: { type: String, default: '' },
    durationMs: { type: Number },
  },
  { timestamps: true }
);

birdDeploymentSchema.index({ routeServer: 1, createdAt: -1 });

export const BirdDeployment = mongoose.model<IBirdDeployment>('BirdDeployment', birdDeploymentSchema);
export default BirdDeployment;
