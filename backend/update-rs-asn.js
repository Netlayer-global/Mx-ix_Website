/**
 * One-off: set every location's route-server ASN to MX-IX's ASN (141539).
 * Run from backend/:  node update-rs-asn.js
 * Uses MONGODB_URI from .env (falls back to local default).
 */
require('dotenv').config();
const mongoose = require('mongoose');

const NEW_ASN = '141539';
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mx-ix-admin';

(async () => {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('locations');

  // Update all route servers across all locations.
  const res = await col.updateMany(
    { 'routeServers.0': { $exists: true } },
    { $set: { 'routeServers.$[].asn': NEW_ASN } }
  );
  console.log(`locations: matched ${res.matchedCount}, modified ${res.modifiedCount}`);

  // Also update the standalone routeservers collection if present (Alice-LG sources).
  try {
    const rsCol = mongoose.connection.collection('routeservers');
    const r2 = await rsCol.updateMany({}, { $set: { asn: Number(NEW_ASN) } });
    console.log(`routeservers: matched ${r2.matchedCount}, modified ${r2.modifiedCount}`);
  } catch (e) {
    console.log('routeservers collection skipped:', e.message);
  }

  await mongoose.disconnect();
  console.log('Done. All route servers now show AS' + NEW_ASN);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
