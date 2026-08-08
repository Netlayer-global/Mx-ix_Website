import mongoose, { Document, Schema } from 'mongoose';

/**
 * Editable email templates. `key` identifies the template used by a flow
 * (e.g. 'password_reset', 'weekly_digest', 'announcement'). Bodies support
 * simple {{placeholder}} variables resolved by the sending flow.
 */
export interface IEmailTemplate extends Document {
  key: string;
  name: string;
  subject: string;
  body: string;
  enabled: boolean;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

const emailTemplateSchema = new Schema<IEmailTemplate>(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    variables: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const EmailTemplate = mongoose.model<IEmailTemplate>('EmailTemplate', emailTemplateSchema);
export default EmailTemplate;
