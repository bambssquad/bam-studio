// GitHub public distribution: reconstruct original encoded bytes before decoding.
export async function fetchModelPayload(file, base, fetchBytes, onChunk) {
 if (!file.parts) return fetchBytes(new URL(file.name, base), file.bytes, onChunk);
 const result = new Uint8Array(file.bytes); let offset = 0;
 for (const part of file.parts) {
  const bytes = new Uint8Array(await fetchBytes(new URL(part.name, base), part.bytes, onChunk));
  if (bytes.byteLength !== part.bytes || offset + bytes.byteLength > result.byteLength) throw new Error('Ukuran bagian model tidak sesuai. Coba muat ulang.');
  result.set(bytes, offset); offset += bytes.byteLength;
 }
 if (offset !== file.bytes) throw new Error('Berkas model belum lengkap. Coba muat ulang.');
 return result.buffer;
}
