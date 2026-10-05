import type { TranscriptSegment } from '../types';
import { splitAudio } from './audioChunks';
import { requestGeminiJSON } from './geminiClient';
import { loadProgress, saveProgress } from './aiProgress';

const stamp = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value/3600)).padStart(2,'0')}:${String(Math.floor(value/60)%60).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
};
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
        if (!Array.isArray(data.segments) || !data.segments.every((s: any) => s && typeof s.text==='string' && typeof s.speaker==='string' &&
          Number.isFinite(s.start) && Number.isFinite(s.end) && s.start>=0 && s.end>=s.start && s.end<=chunk.end-chunk.start+10)) {
          throw new Error(`AI trả lời thoại không hợp lệ ở đoạn ${index+1}. Tiến độ trước đó được giữ.`);
        }
        result = data.segments.map((s: any) => ({ ...s, start:s.start+chunk.start, end:s.end+chunk.start,
          start_fmt:stamp(s.start+chunk.start),end_fmt:stamp(s.end+chunk.start) })) as TranscriptSegment[];
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
