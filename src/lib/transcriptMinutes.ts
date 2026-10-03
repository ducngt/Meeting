import type { AdministrativeMinutes, MeetingMetadata, TranscriptSegment } from '../types';

export function hasMinutesContent(minutes: any): boolean {
  return !!(minutes && (
    (typeof minutes.opening_statement === 'string' && minutes.opening_statement.trim()) ||
    (Array.isArray(minutes.discussions) && minutes.discussions.some((d: any) => typeof d?.content === 'string' && d.content.trim())) ||
    (Array.isArray(minutes.conclusions) && minutes.conclusions.some((c: any) => typeof c === 'string' && c.trim())) ||
    (Array.isArray(minutes.tasks) && minutes.tasks.some((t: any) => typeof t?.task_name === 'string' && t.task_name.trim()))
  ));
}

export async function minutesFromTranscript(
  segments: TranscriptSegment[], metadata: MeetingMetadata, onStatus: (message: string) => void
): Promise<AdministrativeMinutes> {
  const transcript = segments.filter(segment => segment.text?.trim())
    .map(segment => `[${segment.start_fmt || ''}] ${segment.speaker || 'Người phát biểu chưa xác định'}: ${segment.text}`).join('\n');
  if (!transcript) throw new Error('Chưa có lời thoại để soạn biên bản.');
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: `Bạn soạn nội dung biên bản từ bản chép lời tiếng Việt.
Chỉ trả JSON có các trường opening_statement (chuỗi), discussions (mảng đối tượng speaker, role, content, timestamp đều là chuỗi), conclusions (mảng chuỗi), tasks (mảng đối tượng code, task_name, assigned_unit, deadline, requirements đều là chuỗi), closing_statement (chuỗi).
BẮT BUỘC: nếu lời thoại có nội dung, discussions phải có ít nhất một mục tóm tắt trung thực nội dung đó, dù nguồn là bài phát biểu, thuyết trình hay trao đổi và không có quyết định cuộc họp.
Không bịa tên, vai trò, khai mạc, nhiệm vụ, thời hạn, kết luận hay việc thông qua biên bản. Không có dữ liệu cho mục nào thì để chuỗi rỗng hoặc []. Giữ nguyên nhãn người nói chưa xác định. Không biến ý kiến cá nhân thành kết luận của chủ trì.` }] },
    contents: [{ role: 'user', parts: [{ text: `Thông tin khai báo:\n${JSON.stringify(metadata)}\n\nLời thoại nguồn:\n${transcript}` }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });
  const delays = [5000, 15000, 30000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    onStatus('Đang soạn nội dung biên bản từ lời thoại đã nhận diện…');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 190000);
    let response: Response;
    let raw: string;
    try {
      response = await fetch('https://meeting-ai.ducngt.workers.dev/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal,
      });
      raw = await response.text();
    } catch {
      throw new Error('Không kết nối được khi soạn biên bản. Lời thoại vẫn được giữ để thử lại.');
    } finally { clearTimeout(timeout); }
    let data: any;
    try { data = JSON.parse(raw); } catch { data = null; }
    if (!response.ok) {
      if ([500, 502, 503, 504].includes(response.status) && attempt < delays.length) {
        onStatus(`AI đang bận. Thử lại sau ${delays[attempt] / 1000} giây…`);
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        continue;
      }
      throw new Error(data?.error?.message || `Máy chủ báo lỗi ${response.status}.`);
    }
    const candidate = data?.candidates?.[0];
    if (candidate?.finishReason === 'MAX_TOKENS') throw new Error('Kết quả biên bản bị cắt vì quá dài. Lời thoại vẫn được giữ.');
    const parts = candidate?.content?.parts;
    const text = (Array.isArray(parts) ? parts : []).filter((part: any) => !part.thought)
      .map((part: any) => part.text || '').join('').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let result: any;
    try { const parsed = JSON.parse(text); result = parsed.minutes || parsed; }
    catch { throw new Error('AI trả biên bản sai định dạng. Có thể thử lại từ lời thoại.'); }
    const strings = (item: any, fields: string[]) => item && fields.every(field => typeof item[field] === 'string');
    if (!strings(result, ['opening_statement', 'closing_statement']) ||
      !Array.isArray(result.discussions) || !result.discussions.every((d: any) => strings(d, ['speaker', 'role', 'content', 'timestamp'])) ||
      !Array.isArray(result.conclusions) || !result.conclusions.every((c: any) => typeof c === 'string') ||
      !Array.isArray(result.tasks) || !result.tasks.every((t: any) => strings(t, ['code', 'task_name', 'assigned_unit', 'deadline', 'requirements'])) ||
      !result.discussions.some((d: any) => d.content.trim())) {
      throw new Error('AI chưa soạn được nội dung biên bản hợp lệ. Lời thoại vẫn được giữ để thử lại.');
    }
    return { ...result, metadata };
  }
  throw new Error('AI đang bận. Hãy thử lại từ lời thoại sau.');
}
