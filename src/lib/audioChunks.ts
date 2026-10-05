// Split WebM at EBML Cluster boundaries without decoding the full recording.
export interface AudioChunk { blob: Blob; start: number; end: number; }
interface Header { id: number; offset: number; data: number; end: number; unknown: boolean; }
const CLUSTER = 0x1f43b675;
const TOP = new Set([CLUSTER, 0x1549a966, 0x1654ae6b, 0x1c53bb6b, 0x114d9b74, 0x1254c367, 0x1043a770, 0x1941a469]);
function vint(bytes: Uint8Array, position: number, id: boolean): { value: number; width: number; unknown: boolean } {
  let mask = 128, width = 1;
  const first = bytes[position];
  if (!first) throw new Error('Tệp WebM có phần đầu không hợp lệ.');
  while (!(first & mask)) { mask >>= 1; width++; }
  if (width > (id ? 4 : 8) || position + width > bytes.length) throw new Error('Tệp WebM bị thiếu dữ liệu.');
  let value = id ? first : first & (mask - 1);
  let unknown = !id && value === mask - 1;
  for (let i = 1; i < width; i++) {
    const byte = bytes[position + i]; value = value * 256 + byte;
    unknown = unknown && byte === 255;
  }
  return { value, width, unknown };
}
async function header(file: Blob, offset: number): Promise<Header> {
  const bytes = new Uint8Array(await file.slice(offset, offset + 16).arrayBuffer());
  const id = vint(bytes, 0, true);
  const size = vint(bytes, id.width, false);
  const data = offset + id.width + size.width;
  const end = size.unknown ? file.size : data + size.value;
  if (!size.unknown && (!Number.isSafeInteger(end) || end > file.size)) throw new Error('Tệp WebM bị cắt hoặc sai kích thước.');
  return { id: id.value, offset, data, end, unknown: size.unknown };
}
function uint(bytes: Uint8Array): number { return bytes.reduce((a, b) => a * 256 + b, 0); }
function sizeBytes(size: number): Uint8Array<ArrayBuffer> {
  let width = 1;
  while (size >= 2 ** (7 * width) - 1) width++;
  const bytes = new Uint8Array(width);
  let remaining = size;
  for (let i = width - 1; i >= 0; i--) { bytes[i] = remaining % 256; remaining = Math.floor(remaining / 256); }
  bytes[0] |= 1 << (8 - width);
  return bytes;
}
async function clusterEnd(file: Blob, item: Header): Promise<number> {
  if (!item.unknown) return item.end;
  let position = item.data;
  while (position < file.size) {
    const child = await header(file, position);
    if (TOP.has(child.id)) return position;
    if (child.unknown || child.end <= position) throw new Error('Cấu trúc Cluster WebM chưa được hỗ trợ.');
    position = child.end;
  }
  return position;
}
async function clusterTime(file: Blob, item: Header, end: number): Promise<number> {
  let position = item.data;
  while (position < end) {
    const child = await header(file, position);
    if (child.id === 0xe7) return uint(new Uint8Array(await file.slice(child.data, child.end).arrayBuffer()));
    if (child.unknown || child.end <= position) break;
    position = child.end;
  }
  throw new Error('Cluster WebM thiếu mốc thời gian.');
}
async function rewriteCluster(file: Blob, item: Header, end: number, base: number): Promise<Blob> {
  const bytes = new Uint8Array(await file.slice(item.data, end).arrayBuffer());
  const parts: BlobPart[] = []; let cursor = 0, total = 0;
  while (cursor < bytes.length) {
    const id = vint(bytes, cursor, true); const size = vint(bytes, cursor + id.width, false);
    const data = cursor + id.width + size.width, next = data + size.value;
    if (size.unknown || next > bytes.length) throw new Error('Cluster WebM không hợp lệ.');
    if (id.value === 0xe7) {
      let value = uint(bytes.subarray(data, next)) - base;
      if (value < 0) throw new Error('Mốc thời gian WebM không tăng dần.');
      for (let i = next - 1; i >= data; i--) { bytes[i] = value % 256; value = Math.floor(value / 256); }
    }
    if (id.value !== 0xbf) { parts.push(bytes.slice(cursor, next)); total += next - cursor; }
    cursor = next;
  }
  return new Blob([new Uint8Array([0x1f,0x43,0xb6,0x75]),sizeBytes(total),...parts], { type: 'audio/webm' });
}

export async function* splitWebm(file: Blob, seconds = 120): AsyncGenerator<AudioChunk> {
  const ebml = await header(file, 0);
  if (ebml.id !== 0x1a45dfa3 || ebml.unknown) throw new Error('Tệp không phải WebM hợp lệ.');
  let position = ebml.end;
  let root = await header(file, position);
  while (root.id !== 0x18538067) { position = root.end; root = await header(file, position); }
  let info: Blob | undefined, tracks: Blob | undefined, scale = 1000000;
  let parts: Blob[] = [], base = 0, last = 0, bytes = 0;
  const prefix = () => {
    if (!info || !tracks) throw new Error('WebM thiếu thông tin hoặc Track âm thanh.');
    return [file.slice(0, ebml.end), new Uint8Array([0x18,0x53,0x80,0x67,0x01,0xff,0xff,0xff,0xff,0xff,0xff,0xff]), info, tracks];
  };
  position = root.data;
  while (position < root.end) {
    const item = await header(file, position);
    if (item.id === 0x1549a966) {
      const children: Blob[] = []; let length = 0, cursor = item.data;
      while (cursor < item.end) {
        const child = await header(file, cursor);
        if (child.unknown) throw new Error('Info WebM không hợp lệ.');
        if (child.id === 0x2ad7b1) scale = uint(new Uint8Array(await file.slice(child.data, child.end).arrayBuffer()));
        if (![0x4489, 0xbf].includes(child.id)) { children.push(file.slice(cursor, child.end)); length += child.end - cursor; }
        cursor = child.end;
      }
      info = new Blob([new Uint8Array([0x15,0x49,0xa9,0x66]),sizeBytes(length),...children]);
    } else if (item.id === 0x1654ae6b) {
      if (item.end - item.offset > 1024 * 1024) throw new Error('Track WebM quá lớn.');
      tracks = file.slice(item.offset, item.end);
    } else if (item.id === CLUSTER) {
      const end = await clusterEnd(file, item);
      const time = await clusterTime(file, item, end);
      const elapsed = (time - base) * scale / 1e9;
      if (parts.length && (elapsed >= seconds || bytes + end - item.offset > 7 * 1024 * 1024)) {
        yield { blob: new Blob([...prefix(), ...parts], { type: 'audio/webm' }), start: base * scale / 1e9, end: time * scale / 1e9 };
        parts = []; bytes = 0;
      }
      if (!parts.length) base = time;
      if (end - item.offset > 7 * 1024 * 1024) throw new Error('Một Cluster WebM quá lớn; cần chuyển đổi tệp trước khi xử lý.');
      const rewritten = await rewriteCluster(file, item, end, base);
      parts.push(rewritten); bytes += rewritten.size; last = time;
      position = end; continue;
    }
    if (item.unknown || item.end <= position) throw new Error('Tệp WebM có cấu trúc chưa được hỗ trợ.');
    position = item.end;
  }
  if (parts.length) yield { blob: new Blob([...prefix(), ...parts], { type: 'audio/webm' }), start: base * scale / 1e9, end: Math.max(base * scale / 1e9 + 1, last * scale / 1e9 + 33) };
}

export async function* splitAudio(file: Blob): AsyncGenerator<AudioChunk> {
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (signature[0] === 0x1a && signature[1] === 0x45 && signature[2] === 0xdf && signature[3] === 0xa3) {
    yield* splitWebm(file); return;
  }
  // Small other formats can be decoded safely; large WebM never takes this path.
  if (file.size > 32 * 1024 * 1024) throw new Error('Tệp lớn hiện cần định dạng WebM. Hãy dùng tệp WebM ghi từ phần mềm.');
  const context = new AudioContext({ sampleRate: 16000 });
  try {
    const audio = await context.decodeAudioData(await file.arrayBuffer());
    const rate = audio.sampleRate;
    for (let offset = 0; offset < audio.length; offset += rate * 120) {
      const count = Math.min(rate * 120, audio.length - offset);
      const buffer = new ArrayBuffer(44 + count * 2); const view = new DataView(buffer);
      const ascii = (at: number, text: string) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
      ascii(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      ascii(36, 'data'); view.setUint32(40, count * 2, true);
      const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
      for (let i = 0; i < count; i++) {
        const value = Math.max(-1, Math.min(1, channels.reduce((sum, channel) => sum + channel[offset + i], 0) / channels.length));
        view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
      }
      yield { blob: new Blob([buffer], { type: 'audio/wav' }), start: offset / rate, end: (offset + count) / rate };
    }
  } finally { await context.close(); }
}
