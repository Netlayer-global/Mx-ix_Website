import mongoose, { Document, Schema } from 'mongoose';

/**
 * A "Contact Us" / "Request a Port" form submission. Persisted so leads are
 * never lost (even if SMTP delivery fails) and can be reviewed in the admin.
 */
export interface IContactSubmission extends Document {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  department: string;
  location?: string;
  serviceType?: string;
  message?: string;
  emailed: boolean;
  meta?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const contactSubmissionSchema = new Schema<IContactSubmission>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    company: { type: String, default: '' },
    phone: { type: String, default: '' },
    department: { type: String, default: 'sales' },
    location: { type: String, default: '' },
    serviceType: { type: String, default: '' },
    message: { type: String, default: '' },
    emailed: { type: Boolean, default: false },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const ContactSubmission = mongoose.model<IContactSubmission>('ContactSubmission', contactSubmissionSchema);
export default ContactSubmission;
