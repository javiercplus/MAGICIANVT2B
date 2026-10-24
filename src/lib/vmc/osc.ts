'use client';

// Complete OSC 1.0 encoder & decoder (no external deps).
// Supports single OSC messages as well as #bundle (and nested #bundle) packets,
// string ('s'), int32 ('i'), float32 ('f'), and boolean ('T'/'F') arguments.

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type OscArg =
  | { type: 'f'; value: number }
  | { type: 'i'; value: number }
  | { type: 's'; value: string }
  | { type: 'b'; value: boolean };

export interface OscMessage {
  address: string;
  args: (string | number | boolean)[];
}

function pad4(bytes: number[]): void {
  while (bytes.length % 4 !== 0) bytes.push(0);
}

function writeString(bytes: number[], value: string): void {
  const encoded = textEncoder.encode(value);
  for (let i = 0; i < encoded.length; i++) bytes.push(encoded[i]);
  bytes.push(0); // NUL terminator
  pad4(bytes);
}

function writeInt32(bytes: number[], value: number): void {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setInt32(0, value | 0, false); // big-endian
  for (let i = 0; i < 4; i++) bytes.push(view.getUint8(i));
}

function writeFloat32(bytes: number[], value: number): void {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, Number.isFinite(value) ? value : 0, false); // big-endian
  for (let i = 0; i < 4; i++) bytes.push(view.getUint8(i));
}

export function encodeOscTypedMessage(address: string, args: OscArg[]): Uint8Array {
  const bytes: number[] = [];

  writeString(bytes, address);

  let tag = ',';
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.type === 'b') {
      tag += a.value ? 'T' : 'F';
    } else {
      tag += a.type;
    }
  }
  writeString(bytes, tag);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.type === 'f') writeFloat32(bytes, a.value);
    else if (a.type === 'i') writeInt32(bytes, a.value);
    else if (a.type === 's') writeString(bytes, a.value);
  }

  return new Uint8Array(bytes);
}

// Legacy helper for float-only messages
export function encodeOscMessage(address: string, args: number[]): Uint8Array {
  return encodeOscTypedMessage(
    address,
    args.map((v) => ({ type: 'f', value: v })),
  );
}

export function encodeOscBlendshape(name: string, value: number): Uint8Array {
  return encodeOscTypedMessage('/VMC/Ext/Blend/Val', [
    { type: 's', value: name },
    { type: 'f', value },
  ]);
}

// Pack multiple encoded OSC messages into a single OSC #bundle datagram.
export function encodeOscBundle(messages: Uint8Array[]): Uint8Array {
  const bytes: number[] = [];
  // "#bundle\0" (8 bytes)
  writeString(bytes, '#bundle');
  // 8-byte timetag: 0x0000000000000001 ("immediately")
  bytes.push(0, 0, 0, 0, 0, 0, 0, 1);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    writeInt32(bytes, msg.byteLength);
    for (let j = 0; j < msg.byteLength; j++) bytes.push(msg[j]);
  }

  return new Uint8Array(bytes);
}

function readPaddedString(buf: Uint8Array, offset: number): { value: string; next: number } | null {
  if (offset >= buf.length) return null;
  let end = offset;
  while (end < buf.length && buf[end] !== 0) end++;
  if (end >= buf.length) return null;
  const value = textDecoder.decode(buf.subarray(offset, end));
  let next = end + 1;
  while (next % 4 !== 0) next++;
  return { value, next };
}

// Decode a single OSC message or a #bundle (recursively) into flat OscMessage[]
export function decodeOscPacket(data: Uint8Array): OscMessage[] {
  const out: OscMessage[] = [];
  decodeRecursive(data, 0, data.byteLength, out);
  return out;
}

function decodeRecursive(buf: Uint8Array, start: number, end: number, out: OscMessage[]): void {
  if (end - start < 4) return;

  const head = readPaddedString(buf, start);
  if (!head) return;

  if (head.value === '#bundle') {
    // Skip 8-byte timetag
    let offset = head.next + 8;
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    while (offset + 4 <= end) {
      const elemSize = view.getInt32(offset, false);
      offset += 4;
      if (elemSize <= 0 || offset + elemSize > end) break;
      decodeRecursive(buf, offset, offset + elemSize, out);
      offset += elemSize;
    }
    return;
  }

  const address = head.value;
  if (!address.startsWith('/')) return;

  const tagRes = readPaddedString(buf, head.next);
  if (!tagRes || !tagRes.value.startsWith(',')) {
    out.push({ address, args: [] });
    return;
  }

  const tags = tagRes.value.slice(1);
  let offset = tagRes.next;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const args: (string | number | boolean)[] = [];

  for (let i = 0; i < tags.length; i++) {
    const t = tags[i];
    if (t === 'f') {
      if (offset + 4 > end) break;
      args.push(view.getFloat32(offset, false));
      offset += 4;
    } else if (t === 'i') {
      if (offset + 4 > end) break;
      args.push(view.getInt32(offset, false));
      offset += 4;
    } else if (t === 's') {
      const s = readPaddedString(buf, offset);
      if (!s || s.next > end) break;
      args.push(s.value);
      offset = s.next;
    } else if (t === 'T') {
      args.push(true);
    } else if (t === 'F') {
      args.push(false);
    } else if (t === 'd') {
      if (offset + 8 > end) break;
      args.push(view.getFloat64(offset, false));
      offset += 8;
    } else if (t === 'b') {
      // OSC blob: int32 size + padded bytes
      if (offset + 4 > end) break;
      const bSize = view.getInt32(offset, false);
      offset += 4 + bSize;
      while (offset % 4 !== 0) offset++;
    }
  }

  out.push({ address, args });
}
