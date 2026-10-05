import type { TranscriptSegment } from '../types';
import { splitAudio } from './audioChunks';
import { requestGeminiJSON } from './geminiClient';
import { loadProgress, saveProgress } from './aiProgress';

const stamp = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value/3600)).padStart(2,'0')}:${String(Math.floor(value/60)%60).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
};
export function normalizeTranscript(data: any, offset: number, duration: number): TranscriptSegment[] {
  const source = data?.segments ?? data?.transcript;
  if (!Array.isArray(source)) throw new Error('AI không trả danh sách lời thoại.');
  const seconds = (value: unknown): number | undefined => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const cleaned = value.trim();
    if (/^\d+(?:[.,]\d+)?$/.test(cleaned)) return Number(cleaned.replace(',', '.'));
    if (/^\d+:\d{2}(?::\d{2})?(?:\.\d+)?$/.test(cleaned)) {
      const parts = cleaned.split(':').map(Number);
      if (parts.slice(1).some(part => part >= 60)) return undefined;
      return parts.reduce((total,part) => total*60+part,0);
    }
    return undefined;
  };
  // Empty text denotes a pause, not a failure of the complete chunk.
  const spoken = source.filter((item: any) => {
    const text = typeof item === 'string' ? item : item?.text;
    return !(typeof text === 'string' && !text.trim());
  });
  return spoken.map((item: any) => {
    const text = typeof item === 'string' ? item : item?.text;
    if (typeof text !== 'string' || !text.trim()) throw new Error('AI trả một mục lời thoại không có nội dung.');
    const start = seconds(item?.start ?? item?.start_fmt);
    const end = seconds(item?.end ?? item?.end_fmt);
    const timed = start !== undefined && end !== undefined && start >= 0 && end >= start && end <= duration + 10;
    // Numeric anchors are required by the existing type; blank labels mean unknown timing.
    return { start: timed ? start!+offset : offset, end: timed ? end!+offset : offset,
      start_fmt: timed ? stamp(start!+offset) : '', end_fmt: timed ? stamp(end!+offset) : '',
      speaker: typeof item?.speaker === 'string' && item.speaker.trim() ? item.speaker : 'Người phát biểu chưa xác định',
      text: text.trim() };
  });
}
async function base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset=0; offset<bytes.length; offset+=32768) binary += String.fromCharCode(...bytes.subarray(offset,offset+32768));
  return btoa(binary);
}
export async function transcribeLongAudio(file: Blob, sessionId: string,
  onStatus: (message: string) => void, onSegments: (segments: TranscriptSegment[]) => void): Promise<TranscriptSegment[]> {
  const sample = new Blob([file.slice(0,65536), file.slice(Math.max(0,file.size-65536))]);
  const hash = await crypto.subtle.digest('SHA-256', await sample.arrayBuffer());
  const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join('');
  const prefix = `${sessionId}:webm-v1:${file.size}:${fingerprint}`;
  const process = async () => {
    const combined: TranscriptSegment[] = []; let index = 0;
    onStatus('Đang chuẩn bị các đoạn âm thanh ngắn…');
    for await (const chunk of splitAudio(file)) {
      const key = `${prefix}:${index}:${chunk.start.toFixed(6)}`;
      let result = await loadProgress<TranscriptSegment[]>(key);
      if (!result) {
        onStatus(`Đang gỡ băng đoạn ${index+1}, từ ${stamp(chunk.start)}…`);
        const data = await requestGeminiJSON({
          systemInstruction: { parts: [{text: 'Chép lại đầy đủ lời nói tiếng Việt, không tóm tắt. Chỉ trả JSON {"segments":[{"start":0,"end":5,"speaker":"Người phát biểu chưa xác định","text":"Lời nói thực tế"}]}. Mốc thời gian tính từ đầu đoạn này. Không bịa tên người nói. Không nghe rõ ghi [không nghe rõ]. Đoạn thực sự không có lời nói trả segments: [].'}] },
          contents: [{role:'user',parts:[{inlineData:{mimeType:chunk.blob.type,data:await base64(chunk.blob)}},{text:'Gỡ băng toàn bộ đoạn âm thanh này.'}]}],
          generationConfig: {temperature:0.1,responseMimeType:'application/json'},
        },onStatus);
        try {
          result = normalizeTranscript(data, chunk.start, chunk.end-chunk.start);
        } catch {
          console.warn('Định dạng lời thoại AI chưa hợp lệ:', data);
          throw new Error(`AI chưa trả nội dung lời thoại đọc được ở đoạn ${index+1}. Tiến độ trước đó được giữ.`);
        }
        await saveProgress(key,result);
        // Avoid sending many requests simultaneously on the shared free quota.
        await new Promise(resolve => setTimeout(resolve,4000));
      } else onStatus(`Đã khôi phục đoạn ${index+1} từ tiến độ đã lưu…`);
      combined.push(...result); onSegments([...combined]); index++;
    }
    if (!combined.some(s=>s.text.trim())) throw new Error('Chưa nhận diện được lời nói trong bản ghi.');
    return combined;
  };
  // Stop simultaneous processing of the same recording in two browser tabs.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(prefix,{ifAvailable:true},lock=> {
      if (!lock) throw new Error('Cuộc họp này đang được xử lý trong một tab khác.');
      return process();
    });
  }
  return process();
}
