import { lookup as dnsLookup } from 'node:dns';
import { Agent } from 'node:https';
import { BlockList, isIP } from 'node:net';

export function isAllowedPushHost(hostname) {
  const host = String(hostname).toLowerCase();
  return host === 'fcm.googleapis.com'
    || host === 'updates.push.services.mozilla.com'
    || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.push\.apple\.com$/.test(host)
    || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.notify\.windows\.com$/.test(host);
}

const reservedV4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
]) reservedV4.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const reservedV6 = new BlockList();
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]]) {
  reservedV6.addSubnet(address, prefix, 'ipv6');
}

export function isPublicPushAddress(address) {
  const family = isIP(address);
  if (family === 4) return !reservedV4.check(address, 'ipv4');
  if (family === 6) return globalV6.check(address, 'ipv6') && !reservedV6.check(address, 'ipv6');
  return false;
}

// This lookup is used by the actual TLS socket, not by a separate preflight.
// Return only the validated addresses, preserving hostname/SNI/certificate checks.
export function createPushAgent(lookup = dnsLookup) {
  return new Agent({
    keepAlive: false,
    lookup(hostname, options, callback) {
      const blocked = () => callback(Object.assign(new Error('Destino push no permitido.'), { code: 'PUSH_DESTINATION_BLOCKED' }));
      if (!isAllowedPushHost(hostname)) return blocked();
      lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
        if (error) return callback(Object.assign(new Error('No se pudo resolver el proveedor push.'), { code: 'PUSH_DNS_FAILED' }));
        if (!addresses?.length || addresses.some((item) => !isPublicPushAddress(item.address))) return blocked();
        const family = typeof options === 'number' ? options : options?.family;
        const candidates = family ? addresses.filter((item) => item.family === family) : addresses;
        if (!candidates.length) return blocked();
        if (options?.all) callback(null, candidates);
        else callback(null, candidates[0].address, candidates[0].family);
      });
    },
  });
}
