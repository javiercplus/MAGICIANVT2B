'use client';

// Minimal OSC 1.0 encoder (no external deps).
// One datagram = one message (no #bundle). Addresses and type tags are
// NUL-terminated and padded to a multiple of 4 bytes; float arguments are
// written as IEEE-754 big-endian.

const textEncoder = new TextEncoder();

function pad4(bytes: number[]): void {
  while (bytes.length % 4 !== 0) bytes.push(0);
}

function writeString(bytes: number[], value: string): void {
  for (let i = 0; i < value.length; i++) bytes.push(value.charCodeAt(i));
  bytes.push(0); // NUL terminator
  pad4(bytes);
}

function writeFloat32(bytes: number[], value: number): void {
  // Build big-endian IEEE-754 float by hand.
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, false); // false = big-endian
  for (let i = 0; i < 4; i++) bytes.push(view.getUint8(i));
}

// address: '/VMC/Transform/Head', args: number[]
export function encodeOscMessage(address: string, args: number[]): Uint8Array {
  const bytes: number[] = [];

  writeString(bytes, address);

  // Type tag: ',' + one char per argument ('f' = float32)
  let tag = ',';
  for (let i = 0; i < args.length; i++) tag += 'f';
  writeString(bytes, tag);

  for (let i = 0; i < args.length; i++) writeFloat32(bytes, args[i]);

  return new Uint8Array(bytes);
}

export function encodeOscBlendshape(name: string, value: number): Uint8Array {
  return encodeOscMessage(`/VMC/Blendshape/${name}`, [value]);
}
