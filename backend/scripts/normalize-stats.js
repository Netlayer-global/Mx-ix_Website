/**
 * Normalize inflated traffic units in the GlobalStats singleton.
 *
 * Background: capacity and peak-traffic figures were stored with a "Tbps" unit
 * while the magnitudes are only plausible as Gbps (e.g. "195 Tbps" for an
 * exchange whose collector reports ~900 Gbps). This rewrites the unit to Gbps
 * for values that are implausible as Tbps, leaving the numbers untouched.
 *
 * Safe by default: prints a diff and changes nothing unless --apply is passed.
 *
 *   node scripts/normalize-stats.js            # dry run (no writes)
 *   node scripts/normalize-stats.js --apply    # persist changes
 */
require('dotenv').config();
const mongoose = require('mongoose');

// Above this magnitude, a "Tbps" reading is not credible for this exchange.
const TBPS_PLAUSIBILITY_LIMIT = 20;
const TRAFFIC_FIELDS = ['totalCapacity', 'peakTraffic'];

const apply = process.argv.includes('--apply');

const normalizeField = (field) => {
  if (!field || typeof field.value !== 'number') return null;
  if (field.unit !== 'Tbps' || field.value < TBPS_PLAUSIBILITY_LIMIT) return null;
  return { ...field, unit: 'Gbps' };
};

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Run this from the backend directory with a .env present.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const collection = mongoose.connection.collection('globalstats');

  const docs = await collection.find({}).toArray();
  if (!docs.length) {
    console.log('No GlobalStats document found — nothing to normalize.');
    await mongoose.disconnect();
    return;
  }

  let changedDocs = 0;

  for (const doc of docs) {
    const updates = {};

    for (const key of TRAFFIC_FIELDS) {
      const current = doc[key];
      const next = normalizeField(current);
      if (next) {
        updates[key] = next;
        console.log(`${key}: ${current.value} ${current.unit}  ->  ${next.value} ${next.unit}`);
      } else if (current) {
        console.log(`${key}: ${current.value} ${current.unit}  (unchanged)`);
      }
    }

    if (!Object.keys(updates).length) continue;
    changedDocs += 1;

    if (apply) {
      await collection.updateOne({ _id: doc._id }, { $set: updates });
    }
  }

  if (!changedDocs) {
    console.log('\nAll traffic units already look plausible. No changes needed.');
  } else if (apply) {
    console.log(`\nApplied unit corrections to ${changedDocs} document(s).`);
  } else {
    console.log(`\nDry run only. Re-run with --apply to persist changes to ${changedDocs} document(s).`);
  }

  await mongoose.disconnect();
})().catch(async (error) => {
  console.error('Normalization failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
