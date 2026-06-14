/**
 * Idempotently upsert the default editable email templates so admins can
 * customise them in Admin → Email Templates. Non-destructive: only inserts
 * a template if its key doesn't already exist (existing edits are kept).
 *
 * Run from backend/:  node seed-email-templates.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mx-ix-admin';

const DEFAULTS = [
  {
    key: 'password_reset',
    name: 'Password Reset',
    subject: 'Reset your MX-IX portal password',
    body:
      '<p>Hi {{name}},</p>' +
      '<p>We received a request to reset your MX-IX member portal password. This link is valid for one hour:</p>' +
      '<p><a href="{{link}}">{{link}}</a></p>' +
      "<p>If you didn't request this, you can safely ignore this email.</p>" +
      '<p>— MX-IX</p>',
    enabled: true,
    variables: ['name', 'link', 'email'],
  },
  {
    key: 'weekly_digest',
    name: 'Weekly Digest',
    subject: 'Your weekly MX-IX summary',
    body:
      '<h2>MX-IX weekly summary — {{org}}</h2>' +
      '<ul>' +
      '<li><strong>Ports:</strong> {{ports}}</li>' +
      '<li><strong>Open orders:</strong> {{openOrders}}</li>' +
      '<li><strong>Open support tickets:</strong> {{openTickets}}</li>' +
      '<li><strong>ASN:</strong> {{asn}}</li>' +
      '</ul>' +
      '<p>Sign in to the member portal for full details.</p>' +
      '<p>— MX-IX</p>',
    enabled: true,
    variables: ['org', 'ports', 'openOrders', 'openTickets', 'asn'],
  },
];

(async () => {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('emailtemplates');
  let inserted = 0;
  for (const t of DEFAULTS) {
    const res = await col.updateOne(
      { key: t.key },
      { $setOnInsert: { ...t, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
    if (res.upsertedCount) inserted++;
    console.log(`${t.key}: ${res.upsertedCount ? 'inserted' : 'already exists (kept)'}`);
  }
  await mongoose.disconnect();
  console.log(`Done. ${inserted} new template(s) added.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
