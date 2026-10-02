// Gọi trực tiếp Google Gemini từ trình duyệt (dùng cho bản GitHub Pages, không cần máy chủ).
// Khóa API do người dùng tự nhập và chỉ lưu trong trình duyệt của họ.

export function getSystemPrompt(aiEngine: string = 'gemini'): string {
  let engineIntro = 'Bạn là Trợ lý AI chuyên trách soạn thảo Biên bản cuộc họp.';
  if (aiEngine === 'chatgpt') {
    engineIntro =
      'Bạn hoạt động với phong cách và năng lực của ChatGPT (OpenAI GPT-4o), ưu tiên văn phong hành chính trang trọng, súc tích, mạch lạc và bám sát quy chuẩn văn thư.';
  } else if (aiEngine === 'claude') {
    engineIntro =
      'Bạn hoạt động với phong cách và năng lực của Claude (Anthropic Claude 3.5), ưu tiên lập luận logic, phân tích thấu đáo các góc nhìn thảo luận và tổng hợp chỉ đạo chặt chẽ.';
  } else if (aiEngine === 'deepseek') {
    engineIntro =
      'Bạn hoạt động với phong cách và năng lực của DeepSeek AI (R1/V3), ưu tiên bóc tách trách nhiệm, ma trận giao việc rõ ràng và rà soát các điểm trọng yếu.';
  } else {
    engineIntro =
      'Bạn hoạt động với phong cách và năng lực của Google Gemini, tối ưu hóa nhận diện giọng nói đa phương thức và tổng hợp biên bản nhanh chóng, chuẩn xác.';
  }

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
const CANDIDATE_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest'];

// Gemini giới hạn ~20 MB cho toàn bộ yêu cầu gửi kèm dữ liệu âm thanh trực tiếp
const MAX_BASE64_LENGTH = 19 * 1024 * 1024;

export interface AnalyzeOptions {
  apiKey: string;
  audioBase64: string;
  mimeType?: string;
  metadata?: any;
  aiAssistant?: string;
}

export async function analyzeAudioWithGemini(opts: AnalyzeOptions): Promise<any> {
  const { apiKey, audioBase64, mimeType, metadata, aiAssistant = 'gemini' } = opts;

  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chưa nhập khóa Gemini API. Hãy dán khóa vào ô "Khóa Google Gemini API" phía trên.');
  }
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
    systemInstruction: { parts: [{ text: getSystemPrompt(aiAssistant) }] },
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType: cleanMime(mimeType), data: audioBase64 } }, { text: userPrompt }],
      },
    ],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });

  let lastError = 'Không rõ nguyên nhân.';

  for (const model of CANDIDATE_MODELS) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
        body,
      });
    } catch {
      lastError = 'Không kết nối được tới Google. Hãy kiểm tra mạng rồi thử lại.';
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? '').join('');
      const parsed = text ? parseJSONSafely(text) : null;
      if (parsed && parsed.minutes) {
        parsed.ai_engine_used = aiAssistant;
        return parsed;
      }
      lastError = 'AI trả về kết quả không đúng định dạng biên bản. Hãy thử lại.';
      continue;
    }

    let msg = '';
    try {
      const j = await res.json();
      msg = j?.error?.message ?? '';
    } catch {
      /* bỏ qua */
    }

    // Lỗi khóa API: dừng ngay, không thử mô hình khác
    if (res.status === 401 || res.status === 403 || (res.status === 400 && /api key/i.test(msg))) {
      throw new Error(`Khóa Gemini API không hợp lệ hoặc không có quyền sử dụng. ${msg}`.trim());
    }

    lastError = `Mô hình ${model} lỗi ${res.status}${msg ? ': ' + msg : ''}`;
  }

  throw new Error(lastError);
}
