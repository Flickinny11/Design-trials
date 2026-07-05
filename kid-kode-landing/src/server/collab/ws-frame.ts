// PRISM SHELL — RFC 6455 FRAMING (SHELL W7, deviation W7-D1)
//
// A small, dependency-free WebSocket frame codec so the CollabRoom host adds
// ZERO supply-chain surface (no `ws`). Handles exactly what the collab channel
// needs: the handshake accept key, unmasking client→server frames, emitting
// unmasked server→client text frames, control frames (ping/pong/close), 7/16/
// 64-bit payload lengths, and message reassembly across continuation frames.
// A Cloudflare Durable Object never touches this — the platform frames for it;
// this file exists purely so the LOCAL host can run under `next dev`.

import { createHash } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** Sec-WebSocket-Accept for the handshake response. */
export function acceptKey(secWebSocketKey: string): string {
  return createHash('sha1')
    .update(secWebSocketKey + GUID)
    .digest('base64');
}

export const OPCODE = {
  continuation: 0x0,
  text: 0x1,
  binary: 0x2,
  close: 0x8,
  ping: 0x9,
  pong: 0xa,
} as const;

function encodeFrame(opcode: number, payload: Uint8Array): Uint8Array {
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.from([0x80 | opcode, 126, 0, 0]);
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.from([0x80 | opcode, 127, 0, 0, 0, 0, 0, 0, 0, 0]);
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

/** Server→client text frame (unmasked, per RFC 6455 §5.1). */
export function encodeText(text: string): Uint8Array {
  return encodeFrame(OPCODE.text, Buffer.from(text, 'utf8'));
}

export function encodePong(payload: Uint8Array): Uint8Array {
  return encodeFrame(OPCODE.pong, payload);
}

export function encodePing(): Uint8Array {
  return encodeFrame(OPCODE.ping, Buffer.alloc(0));
}

export function encodeClose(code = 1000): Uint8Array {
  const body = Buffer.alloc(2);
  body.writeUInt16BE(code, 0);
  return encodeFrame(OPCODE.close, body);
}

export type DecodedMessage =
  | { type: 'text'; data: string }
  | { type: 'binary'; data: Uint8Array }
  | { type: 'ping'; data: Uint8Array }
  | { type: 'pong'; data: Uint8Array }
  | { type: 'close'; data: Uint8Array };

/** Streaming decoder: `push()` bytes off the socket, get back any COMPLETE
 *  messages (data messages reassembled across continuation frames). */
export class FrameDecoder {
  private buf: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  private fragOpcode: number | null = null;
  private fragChunks: Buffer[] = [];

  push(chunk: Buffer): DecodedMessage[] {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    const out: DecodedMessage[] = [];
    for (;;) {
      const frame = this.readFrame();
      if (!frame) break;
      const { fin, opcode, payload } = frame;

      if (opcode === OPCODE.close || opcode === OPCODE.ping || opcode === OPCODE.pong) {
        out.push({
          type:
            opcode === OPCODE.close ? 'close' : opcode === OPCODE.ping ? 'ping' : 'pong',
          data: payload,
        });
        continue;
      }

      if (opcode === OPCODE.continuation) {
        if (this.fragOpcode === null) continue; // stray continuation — drop
        this.fragChunks.push(payload);
      } else {
        // New data message (text/binary).
        this.fragOpcode = opcode;
        this.fragChunks = [payload];
      }

      if (fin) {
        const full = Buffer.concat(this.fragChunks);
        const wasText = this.fragOpcode === OPCODE.text;
        this.fragOpcode = null;
        this.fragChunks = [];
        out.push(
          wasText
            ? { type: 'text', data: full.toString('utf8') }
            : { type: 'binary', data: full },
        );
      }
    }
    return out;
  }

  /** Pull one frame off the front of the buffer, or null if incomplete. */
  private readFrame(): { fin: boolean; opcode: number; payload: Buffer } | null {
    const b = this.buf;
    if (b.length < 2) return null;
    const fin = (b[0] & 0x80) !== 0;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let offset = 2;
    if (len === 126) {
      if (b.length < offset + 2) return null;
      len = b.readUInt16BE(offset);
      offset += 2;
    } else if (len === 127) {
      if (b.length < offset + 8) return null;
      len = Number(b.readBigUInt64BE(offset));
      offset += 8;
    }
    let maskKey: Buffer | null = null;
    if (masked) {
      if (b.length < offset + 4) return null;
      maskKey = b.subarray(offset, offset + 4);
      offset += 4;
    }
    if (b.length < offset + len) return null;
    let payload = b.subarray(offset, offset + len);
    if (maskKey) {
      const unmasked = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) unmasked[i] = payload[i] ^ maskKey[i & 3];
      payload = unmasked;
    } else {
      payload = Buffer.from(payload); // detach from the shared buffer
    }
    this.buf = b.subarray(offset + len);
    return { fin, opcode, payload };
  }
}
