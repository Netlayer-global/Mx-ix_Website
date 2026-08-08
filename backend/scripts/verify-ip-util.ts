/**
 * Self-check for the IP/CIDR maths behind IPAM and route-server config
 * generation. No database or network needed.
 *
 *   cd backend
 *   node node_modules/typescript/bin/tsc scripts/verify-ip-util.ts --outDir .tmpcheck \
 *        --module commonjs --target ES2020 --esModuleInterop --skipLibCheck
 *   node .tmpcheck/scripts/verify-ip-util.js
 *
 * These are pure functions whose output ends up in live BIRD config, so a wrong
 * address here means a broken or hijacked session. Worth re-running after
 * touching src/utils/ip.util.ts or the IPv6 addressing logic in
 * src/services/ipam.service.ts.
 */
import ip from '../src/utils/ip.util';
import { suggestIpv6ForAsn } from '../src/services/ipam.service';

let failures = 0;

const eq = (label: string, got: unknown, want: unknown): void => {
  const ok = String(got) === String(want);
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  (got ${got}, want ${want})`}`);
};

const throws = (label: string, fn: () => unknown): void => {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) failures++;
  console.log(`${threw ? 'ok  ' : 'FAIL'} ${label}${threw ? '' : '  (expected a throw)'}`);
};

console.log('\n-- IPv4 --');
eq('ipv4ToInt 103.139.191.1', ip.ipv4ToInt('103.139.191.1'), 1737211649);
eq('high first octet stays unsigned', ip.ipv4ToInt('191.0.0.0'), 3204448256);
eq('intToIpv4 roundtrip', ip.intToIpv4(ip.ipv4ToInt('192.0.2.130')), '192.0.2.130');
eq('reject leading zero', ip.isIpv4('192.0.2.01'), false);
eq('reject 256', ip.isIpv4('192.0.2.256'), false);

console.log('\n-- IPv6 --');
eq('expand ::1', ip.expandIpv6('::1'), '0000:0000:0000:0000:0000:0000:0000:0001');
eq('expand 2001:db8::', ip.expandIpv6('2001:db8::'), '2001:0db8:0000:0000:0000:0000:0000:0000');
eq('compress', ip.compressIpv6('2001:0db8:0000:0000:0000:0000:0000:0001'), '2001:db8::1');
eq('single zero group not collapsed', ip.compressIpv6('2001:db8:0:1:1:1:1:1'), '2001:db8:0:1:1:1:1:1');
eq('all zeros', ip.compressIpv6('0000:0000:0000:0000:0000:0000:0000:0000'), '::');
eq('roundtrip', ip.bigIntToIpv6(ip.ipv6ToBigInt('2001:db8:1::6:4500:1')), '2001:db8:1::6:4500:1');
eq('embedded v4', ip.expandIpv6('::ffff:192.0.2.1'), '0000:0000:0000:0000:0000:ffff:c000:0201');
eq('zone id stripped', ip.compressIpv6('fe80::1%eth0'), 'fe80::1');
// Malformed forms that a filter-empty-groups parser would wrongly accept.
eq('reject triple colon', ip.isIpv6('2001:db8:::1'), false);
eq('reject leading single colon', ip.isIpv6(':1:2:3:4:5:6:7'), false);
eq('reject trailing single colon', ip.isIpv6('1:2:3:4:5:6:7:8:'), false);
eq('reject two double colons', ip.isIpv6('2001::db8::1'), false);
eq('reject 9 groups', ip.isIpv6('1:2:3:4:5:6:7:8:9'), false);
eq('reject bad hex group', ip.isIpv6('2001:db8::zzzz'), false);

console.log('\n-- CIDR --');
eq('v4 network', ip.parseCidr('103.139.191.0/24').network, '103.139.191.0');
eq('v4 size', ip.parseCidr('103.139.191.0/24').size, 256n);
eq('v4 /32 size', ip.parseCidr('192.0.2.1/32').size, 1n);
eq('host bits masked off', ip.normalizeCidr('103.139.191.77/24'), '103.139.191.0/24');
eq('v6 network', ip.parseCidr('2001:db8:1::/64').network, '2001:db8:1::');
eq('v6 /64 size', ip.parseCidr('2001:db8:1::/64').size, 18446744073709551616n);
throws('reject missing prefix length', () => ip.parseCidr('103.139.191.0'));
throws('reject v4 /33', () => ip.parseCidr('103.139.191.0/33'));
throws('reject v6 /129', () => ip.parseCidr('2001:db8::/129'));

console.log('\n-- containment --');
eq('in range', ip.isInCidr('103.139.191.42', '103.139.191.0/24'), true);
eq('out of range', ip.isInCidr('103.139.192.42', '103.139.191.0/24'), false);
eq('family mismatch', ip.isInCidr('2001:db8::1', '103.139.191.0/24'), false);
eq('v6 in range', ip.isInCidr('2001:db8:1::6:4500:1', '2001:db8:1::/64'), true);

console.log('\n-- sort keys (drive "next free address") --');
eq('v4 key width', ip.sortKeyFor('103.139.191.1', 4).length, 8);
eq('v6 key width', ip.sortKeyFor('2001:db8::1', 6).length, 32);
eq('9 sorts before 10', ip.sortKeyFor('103.139.191.9', 4) < ip.sortKeyFor('103.139.191.10', 4), true);
eq('255 sorts after 9', ip.sortKeyFor('103.139.191.255', 4) > ip.sortKeyFor('103.139.191.9', 4), true);

console.log('\n-- ASN-encoded IPv6 --');
eq('AS64500', suggestIpv6ForAsn('2001:db8:1::/64', 64500), '2001:db8:1::6:4500:1');
eq('AS132215', suggestIpv6ForAsn('2001:db8:1::/64', 132215), '2001:db8:1::13:2215:1');
eq('AS715', suggestIpv6ForAsn('2001:db8:1::/64', 715), '2001:db8:1::715:1');
eq('index respected', suggestIpv6ForAsn('2001:db8:1::/64', 715, 2), '2001:db8:1::715:2');
eq('prefix too small', suggestIpv6ForAsn('2001:db8:1::/120', 64500), 'null');
eq('rejects v4 prefix', suggestIpv6ForAsn('103.139.191.0/24', 64500), 'null');

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
