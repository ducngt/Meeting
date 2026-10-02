// Gọi Gemini qua Cloudflare Worker. Key chỉ nằm trong Secret của Worker.

export function getSystemPrompt(): string {
  const engineIntro = 'Bạn là trợ lý Google Gemini chuyên gỡ băng tiếng Việt và soạn biên bản theo nguồn âm thanh.';

  return `${engineIntro}
Nhiệm vụ của bạn là:
1. Gỡ băng trung thực lời nói tiếng Việt từ file ghi âm cuộc họp (kèm mốc thời gian [HH:MM:SS] và tên người phát biểu).
2. Soạn thảo BIÊN BẢN CUỘC HỌP CHUẨN NGHỊ ĐỊNH 30/2020/NĐ-CP của Chính phủ về công tác văn thư, thể thức văn bản hành chính phục vụ Hội nghị/Cuộc họp.

BẮT BUỘC TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON với cấu trúc chính xác sau:
{
  "segments": [
    {
      "start": 0.0,
      "end": 5.0,
      "start_fmt": "00:00:00",
      "end_fmt": "00:00:05",
      "speaker": "Tên người nói hoặc [Chủ trì/Đại biểu]",
      "text": "Nội dung lời nói thực tế nghe được"
    }
  ],
  "minutes": {
    "opening_statement": "Đồng chí Chủ trì phát biểu khai mạc, nêu rõ mục đích, yêu cầu và nội dung trọng tâm của cuộc họp.",
    "discussions": [
      {
        "speaker": "Tên người phát biểu",
        "role": "Chức vụ (nếu có)",
        "content": "Tóm tắt trung thực, ngắn gọn nội dung ý kiến đóng góp",
        "timestamp": "00:00:00"
      }
    ],
    "conclusions": [
      "Nội dung kết luận, chỉ đạo 1 của Chủ trì cuộc họp",
      "Nội dung kết luận, chỉ đạo 2 của Chủ trì cuộc họp"
    ],
    "tasks": [
      {
        "code": "NV-01",
        "task_name": "Tên nhiệm vụ hoặc sản phẩm đầu ra cụ thể",
        "assigned_unit": "Đơn vị hoặc cá nhân chủ trì thực hiện",
        "deadline": "Thời hạn hoàn thành (ngày/tháng/năm hoặc tuần)",
        "requirements": "Yêu cầu chất lượng hoặc lưu ý thực thi"
      }
    ],
    "closing_statement": "Cuộc họp kết thúc vào hồi ... cùng ngày. Biên bản này đã được đọc lại cho toàn thể thành viên tham dự nghe và nhất trí thông qua."
  }
}`;
}

export function cleanMime(mimeType?: string): string {
  let clean = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
  if (clean.includes('wav')) return 'audio/wav';
  if (clean.includes('mp3') || clean.includes('mpeg')) return 'audio/mp3';
  if (clean.includes('ogg')) return 'audio/ogg';
  if (clean.includes('mp4') || clean.includes('m4a')) return 'audio/mp4';
  if (clean.includes('aac')) return 'audio/aac';
  if (clean.includes('flac')) return 'audio/flac';
  return 'audio/webm';
}

export function parseJSONSafely(text: string): any {
  let raw = text.trim();
  if (raw.startsWith('```json')) raw = raw.slice(7);
  if (raw.startsWith('```')) raw = raw.slice(3);
  if (raw.endsWith('```')) raw = raw.slice(0, -3);
  raw = raw.trim();

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    raw = raw.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('[API] Lỗi parse JSON:', e);
    return null;
  }
}

// Danh sách mô hình thử lần lượt nếu mô hình trước bị quá tải hoặc không tồn tại
const WORKER_URL = 'https://TEN-WORKER.TAI-KHOAN.workers.dev/analyze';

// Gemini giới hạn ~20 MB cho toàn bộ yêu cầu gửi kèm dữ liệu âm thanh trực tiếp
const MAX_BASE64_LENGTH = 19 * 1024 * 1024;

export interface AnalyzeOptions {
  audioBase64: string;
  mimeType?: string;
  metadata?: any;
}

export async function analyzeAudioWithGemini(opts: AnalyzeOptions): Promise<any> {
  const { audioBase64, mimeType, metadata } = opts;

  if (!audioBase64) {
    throw new Error('Không có dữ liệu âm thanh cuộc họp để phân tích.');
  }
  if (audioBase64.length > MAX_BASE64_LENGTH) {
    throw new Error(
      'File ghi âm quá lớn (giới hạn khoảng 14 MB, tương đương 15-30 phút tùy định dạng). Hãy cắt ngắn hoặc nén file rồi thử lại.'
    );
  }

  const userPrompt = `Dưới đây là thông tin cuộc họp hành chính do thư ký khai báo:
${JSON.stringify(metadata || {}, null, 2)}

Hãy nghe toàn bộ tệp âm thanh này, gỡ băng tiếng Việt trung thực và soạn thảo BIÊN BẢN CUỘC HỌP CHUẨN NGHỊ ĐỊNH 30/2020/NĐ-CP theo đúng định dạng JSON yêu cầu.`;

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: getSystemPrompt() }] },
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType: cleanMime(mimeType), data: audioBase64 } }, { text: userPrompt }],
      },
    ],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });

  let res: Response;
  try {
    res = await fetch(WORKER_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body, signal: AbortSignal.timeout(190000)
    });
  } catch {
    throw new Error('Không kết nối được máy chủ phân tích. Kiểm tra URL Worker, mạng hoặc thử bản ghi ngắn hơn.');
  }
  let data: any;
  try { data = await res.json(); }
  catch { throw new Error('Máy chủ trả về dữ liệu không hợp lệ.'); }
  if (!res.ok) {
    const message = data?.error?.message || `Lỗi máy chủ ${res.status}`;
    if (res.status === 429) throw new Error('Dịch vụ AI dùng chung đã hết hạn mức tạm thời. Hãy thử lại sau.');
    throw new Error(message);
  }
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .filter((part: any) => !part.thought).map((part: any) => part.text || '').join('');
  const parsed = text ? parseJSONSafely(text) : null;
  if (!parsed?.minutes) throw new Error('AI chưa trả về biên bản hợp lệ. Hãy thử bản ghi rõ hơn.');
  parsed.ai_engine_used = 'gemini';
  return parsed;
}
