// PRISM FLIGHT RECORDER — sortable record ids.
//
// A ULID-shaped id: a 48-bit millisecond timestamp (Crockford base32, 10 chars)
// + 80 bits of randomness (16 chars). Lexicographically sortable by creation
// time, so a corpus reader can range-scan by id without a separate index. No
// external dependency (the recorder must add zero runtime deps).

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(ms: number, len: number): string {
  let out = '';
  let n = ms;
  for (let i = 0; i < len; i += 1) {
    out = CROCKFORD[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

function randomPart(len: number, rnd: () => number): string {
  let out = '';
  for (let i = 0; i < len; i += 1) out += CROCKFORD[Math.floor(rnd() * 32)];
  return out;
}

/** Generate a sortable record id. `now`/`rnd` are injectable for deterministic
 *  tests (the writer passes real Date.now / Math.random in production). */
export function makeRecordId(now: number = Date.now(), rnd: () => number = Math.random): string {
  return encodeTime(now, 10) + randomPart(16, rnd);
}
