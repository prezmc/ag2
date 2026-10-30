/**
 * Device address validation (shared by client forms and server routes).
 *
 * AirGradient devices live on the local network, so only private IPv4
 * addresses are accepted. This blocks the app from being used to make
 * requests to arbitrary internet hosts (SSRF), and hostnames are refused
 * because they can be re-pointed via DNS after validation.
 *
 *   Allowed:  10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 *   Blocked:  169.254.0.0/16 link-local — includes 169.254.169.254, the cloud
 *             metadata service; AirGradient monitors never use this range
 *   Optional: 127.0.0.0/8 (only when allowLoopback is set — for local dev
 *             against a mock device; never enable in production)
 */

export interface AddressValidationOptions {
  allowLoopback?: boolean;
}

export interface AddressValidationResult {
  valid: boolean;
  /** Normalized base URL, e.g. http://192.168.1.100 or http://192.168.1.100:8080 */
  normalized?: string;
  error?: string;
}

/** Repeatedly decode until stable — defeats double/triple-encoding tricks. */
export function fullyDecode(str: string): string {
  let current = str;
  try {
    let next = decodeURIComponent(current);
    while (next !== current) {
      current = next;
      next = decodeURIComponent(current);
    }
  } catch {
    // Malformed encoding — use the last good value
  }
  return current;
}

/** Strict dotted-quad IPv4 parse (no leading zeros, which some stacks read as octal). */
export function parseIPv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    if (p.length > 1 && p.startsWith('0')) return null;
    const n = parseInt(p, 10);
    if (n > 255) return null;
    octets.push(n);
  }
  return octets;
}

export function isPrivateIPv4(octets: number[], allowLoopback = false): boolean {
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (allowLoopback && a === 127) return true;
  return false;
}

export function validateDeviceAddress(
  input: string,
  opts: AddressValidationOptions = {},
): AddressValidationResult {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return { valid: false, error: 'Address is required' };

  const decoded = fullyDecode(trimmed);

  // Only http is meaningful for the AirGradient local API
  const withoutProto = decoded.replace(/^http:\/\//i, '');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(withoutProto)) {
    return { valid: false, error: 'Only plain http:// addresses are supported' };
  }

  // Allow an optional trailing slash, but no path, query, credentials or fragment
  const hostPort = withoutProto.replace(/\/$/, '');
  if (/[/?#@\\\s]/.test(hostPort)) {
    return { valid: false, error: 'Enter just the IP address (and optional port), without a path' };
  }

  const [host, port, ...extra] = hostPort.split(':');
  if (extra.length > 0) return { valid: false, error: 'Invalid address format' };

  const octets = parseIPv4(host);
  if (!octets) {
    return {
      valid: false,
      error: 'Enter an IPv4 address, e.g. 192.168.1.100 (hostnames are not allowed)',
    };
  }

  if (!isPrivateIPv4(octets, opts.allowLoopback)) {
    return {
      valid: false,
      error: 'Address must be on your local network (10.x, 172.16–31.x or 192.168.x)',
    };
  }

  if (port !== undefined) {
    if (!/^\d{1,5}$/.test(port)) return { valid: false, error: 'Invalid port number' };
    const p = parseInt(port, 10);
    if (p < 1 || p > 65535) return { valid: false, error: 'Port must be between 1 and 65535' };
  }

  const normalized = `http://${octets.join('.')}${port ? `:${parseInt(port, 10)}` : ''}`;
  return { valid: true, normalized };
}

/** Server-side policy: loopback only when explicitly enabled for development. */
export function serverAddressOptions(): AddressValidationOptions {
  return { allowLoopback: process.env.ALLOW_LOOPBACK_DEVICES === 'true' };
}
