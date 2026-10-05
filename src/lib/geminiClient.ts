// Gọi Gemini qua Cloudflare Worker.
// API key chỉ nằm trong Secret của Worker.

export function getSystemPrompt(): string {
  return `Bạn là trợ lý chuyên gỡ băng tiếng Việt và soạn biên bản cuộc họp từ nguồn âm thanh.

Nhiệm vụ:
1. Gỡ băng trung thực lời nói tiếng Việt, kèm mốc thời gian và người phát biểu nếu xác định được.
2. Soạn nội dung biên bản hành chính để đưa vào mẫu biên bản có sẵn của phần mềm.

Yêu cầu bắt buộc:
- Chỉ trả về một đối tượng JSON, không thêm giải thích hoặc Markdown.
- Không bịa nội dung, tên người nói, kết luận, nhiệm vụ hoặc thời hạn.
- Không coi các ví dụ cấu trúc là nội dung cuộc họp.
- Không xác định người phát biểu chỉ dựa trên danh sách đại biểu.
- Khi không biết tên người nói, dùng "Người phát biểu chưa xác định".
- Thông tin chưa biết để chuỗi rỗng; danh sách không có dữ liệu để [].
- Không khẳng định biên bản đã được đọc lại hoặc thông qua nếu âm thanh không xác nhận.
- Không tự suy ra giờ kết thúc cuộc họp từ thời lượng tệp.
- start và end là số giây tính từ đầu tệp, end không nhỏ hơn start.
- start_fmt, end_fmt và timestamp dùng định dạng HH:MM:SS.

Cấu trúc JSON:
{
  "segments": [
    {
      "start": 0,
      "end": 5,
      "start_fmt": "00:00:00",
      "end_fmt": "00:00:05",
      "speaker": "",
      "text": ""
    }
  ],
  "minutes": {
    "opening_statement": "",
    "discussions": [
      {
        "speaker": "",
        "role": "",
        "content": "",
        "timestamp": ""
      }
    ],
    "conclusions": [],
    "tasks": [
      {
        "code": "NV-01",
        "task_name": "",
        "assigned_unit": "",
        "deadline": "",
        "requirements": ""
      }
    ],
    "closing_statement": ""
  }
}`;
}

export function cleanMime(mimeType?: string): string {
  const clean = (mimeType || 'audio/webm')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (clean.includes('wav')) return 'audio/wav';
  if (clean.includes('mp3') || clean.includes('mpeg')) {
    return 'audio/mp3';
  }
  if (clean.includes('ogg')) return 'audio/ogg';
  if (clean.includes('mp4') || clean.includes('m4a')) {
    return 'audio/mp4';
  }
  if (clean.includes('aac')) return 'audio/aac';
  if (clean.includes('flac')) return 'audio/flac';

  return 'audio/webm';
}

export function parseJSONSafely(text: string): any {
  let raw = text.trim();

  raw = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  // Thử đọc JSON nguyên vẹn trước.
  try {
    return JSON.parse(raw);
  } catch {
    // Xử lý trường hợp AI thêm lời dẫn trước hoặc sau JSON.
  }

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }

  return null;
}

const WORKER_URL =
  'https://meeting-ai.ducngt.workers.dev/analyze';

// Giới hạn của bản Worker hiện tại: 20 MiB cho toàn bộ yêu cầu.
const MAX_REQUEST_BYTES = 20 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 190_000;

// Một lần gọi ban đầu và tối đa ba lần thử lại.
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000];

export interface AnalyzeOptions {
  audioBase64: string;
  mimeType?: string;
  metadata?: any;

  // Tùy chọn; App.tsx cũ vẫn hoạt động khi không truyền vào.
  onStatus?: (message: string) => void;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

function reportStatus(
  callback: AnalyzeOptions['onStatus'],
  message: string
): void {
  try {
    callback?.(message);
  } catch {
    // Lỗi cập nhật thông báo không làm gián đoạn phân tích.
  }
}

function hasStrings(value: any, fields: string[]): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    fields.every(field => typeof value[field] === 'string')
  );
}

function validateResult(parsed: any): boolean {
  const minutes = parsed?.minutes;

  return (
    hasStrings(minutes, [
      'opening_statement',
      'closing_statement',
    ]) &&
    Array.isArray(minutes.discussions) &&
    minutes.discussions.every((item: any) =>
      hasStrings(item, [
        'speaker',
        'role',
        'content',
        'timestamp',
      ])
    ) &&
    Array.isArray(minutes.conclusions) &&
    minutes.conclusions.every(
      (item: any) => typeof item === 'string'
    ) &&
    Array.isArray(minutes.tasks) &&
    minutes.tasks.every((item: any) =>
      hasStrings(item, [
        'code',
        'task_name',
        'assigned_unit',
        'deadline',
        'requirements',
      ])
    ) &&
    Array.isArray(parsed.segments) &&
    parsed.segments.every(
      (item: any) =>
        hasStrings(item, [
          'start_fmt',
          'end_fmt',
          'speaker',
          'text',
        ]) &&
        typeof item.start === 'number' &&
        Number.isFinite(item.start) &&
        item.start >= 0 &&
        typeof item.end === 'number' &&
        Number.isFinite(item.end) &&
        item.end >= item.start
    )
  );
}

function getErrorMessage(
  status: number,
  data: any
): string {
  const message =
    typeof data?.error?.message === 'string'
      ? data.error.message
      : '';

  if (status === 429) {
    return (
      'Dịch vụ AI đã vượt hạn mức yêu cầu. ' +
      'Hãy chờ rồi thử lại.'
    );
  }

  if (status === 503) {
    return (
      'AI vẫn đang quá tải sau các lần thử lại. ' +
      'Hãy giữ bản ghi âm và thử lại sau vài phút.'
    );
  }

  if (status === 413) {
    return (
      'Tệp ghi âm vượt giới hạn dung lượng của máy chủ. ' +
      'Hãy nén hoặc chia nhỏ tệp rồi thử lại.'
    );
  }

  if (status === 504) {
    return (
      'Máy chủ xử lý quá lâu và đã hết thời gian chờ. ' +
      'Hãy thử lại hoặc dùng bản ghi ngắn hơn.'
    );
  }

  if (/user location is not supported/i.test(message)) {
    return (
      'Google từ chối vị trí xử lý của Worker. ' +
      'Cần kiểm tra cấu hình vị trí Worker.'
    );
  }

  return message || `Máy chủ phân tích báo lỗi ${status}.`;
}

export async function analyzeAudioWithGemini(
  opts: AnalyzeOptions
): Promise<any> {
  const {
    audioBase64,
    mimeType,
    metadata,
    onStatus,
  } = opts;

  if (
    typeof audioBase64 !== 'string' ||
    !audioBase64.trim()
  ) {
    throw new Error(
      'Không có dữ liệu âm thanh cuộc họp để phân tích.'
    );
  }

  // Loại bỏ tiền tố Data URL nếu đầu vào có tiền tố.
  const audioData = audioBase64
    .trim()
    .replace(/^data:[^,]*;base64,/i, '')
    .replace(/\s+/g, '');

  if (!audioData) {
    throw new Error('Dữ liệu âm thanh bị trống.');
  }

  // Kiểm tra sớm để tránh tạo yêu cầu quá lớn.
  if (audioData.length >= MAX_REQUEST_BYTES) {
    throw new Error(
      'Tệp ghi âm quá lớn để gửi trực tiếp. ' +
      'Hãy nén hoặc chia nhỏ tệp rồi thử lại.'
    );
  }

  const userPrompt = `Thông tin cuộc họp do thư ký khai báo:
${JSON.stringify(metadata || {}, null, 2)}

Hãy nghe toàn bộ âm thanh, gỡ băng trung thực và soạn nội dung biên bản theo cấu trúc JSON đã yêu cầu.
Thông tin khai báo chỉ cung cấp bối cảnh; không dùng để bịa nội dung phát biểu.
Chỉ ghi nhận kết luận và nhiệm vụ có căn cứ trong âm thanh.`;

  const body = JSON.stringify({
    systemInstruction: {
      parts: [{ text: getSystemPrompt() }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: cleanMime(mimeType),
              data: audioData,
            },
          },
          { text: userPrompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  // Tính cả prompt và thông tin cuộc họp trong giới hạn.
  if (new Blob([body]).size > MAX_REQUEST_BYTES) {
    throw new Error(
      'Tổng dữ liệu gửi vượt giới hạn 20 MiB. ' +
      'Tệp âm thanh cần nhỏ hơn khoảng 15 MiB; ' +
      'hãy nén hoặc chia nhỏ tệp.'
    );
  }

  for (
    let attempt = 0;
    attempt <= RETRY_DELAYS_MS.length;
    attempt++
  ) {
    reportStatus(
      onStatus,
      attempt === 0
        ? 'Đang phân tích âm thanh và soạn biên bản…'
        : `Đang thử lại lần ${attempt}/${RETRY_DELAYS_MS.length}…`
    );

    let response: Response;

    // Mỗi lần thử có bộ đếm thời gian riêng.
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    let responseText: string;

    try {
      response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal,
      });

      responseText = await response.text();
    } catch {
      if (controller.signal.aborted) {
        throw new Error(
          'Đã hết thời gian chờ phân tích. ' +
          'Bản ghi âm vẫn được giữ trong phiên hiện tại; ' +
          'hãy thử lại hoặc dùng bản ghi ngắn hơn.'
        );
      }

      throw new Error(
        'Không kết nối được máy chủ phân tích. ' +
        'Hãy kiểm tra mạng và thử lại.'
      );
    } finally {
      clearTimeout(timeout);
    }

    let data: any = null;

    try {
      data = JSON.parse(responseText);
    } catch {
      // Máy chủ quá tải có thể trả về HTML thay vì JSON.
    }

    if (!response.ok) {
      // Chỉ tự thử lại các lỗi máy chủ tạm thời.
      // Không tự thử lại lỗi khóa, vị trí hoặc hạn mức.
      const retryable = [
        500,
        502,
        503,
        504,
      ].includes(response.status);

      if (
        retryable &&
        attempt < RETRY_DELAYS_MS.length
      ) {
        const delay = RETRY_DELAYS_MS[attempt];

        reportStatus(
          onStatus,
          `AI đang bận. Sẽ thử lại sau ${delay / 1000} giây…`
        );

        await wait(delay);
        continue;
      }

      throw new Error(
        getErrorMessage(response.status, data)
      );
    }

    if (!data) {
      throw new Error(
        'Máy chủ trả về dữ liệu không hợp lệ. ' +
        'Hãy giữ bản ghi âm và thử lại.'
      );
    }

    const candidate = data?.candidates?.[0];

    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new Error(
        'Kết quả quá dài và bị cắt trước khi hoàn tất. ' +
        'Cần chia bản ghi thành các đoạn để xử lý đầy đủ.'
      );
    }

    const parts = candidate?.content?.parts;

    const text = Array.isArray(parts)
      ? parts
          .filter(
            (part: any) =>
              !part.thought &&
              typeof part.text === 'string'
          )
          .map((part: any) => part.text)
          .join('')
      : '';

    const parsed = text
      ? parseJSONSafely(text)
      : null;

    if (!validateResult(parsed)) {
      throw new Error(
        'AI chưa trả về biên bản đúng cấu trúc. ' +
        'Hãy thử lại; nếu bản ghi dài, cần chia thành các đoạn.'
      );
    }

    // Bảo đảm biên bản dùng thông tin thư ký đã khai báo.
    parsed.minutes.metadata = metadata || {};
    parsed.ai_engine_used = 'gemini';

    reportStatus(
      onStatus,
      'Đã hoàn thành phân tích và soạn biên bản.'
    );

    return parsed;
  }

  throw new Error(
    'Chưa phân tích được âm thanh. Hãy thử lại sau.'
  );
}
// Small, bounded requests for chunk transcription and transcript summaries.
export async function requestGeminiJSON(body: unknown, onStatus: (message: string) => void): Promise<any> {
  const payload = JSON.stringify(body);
  if (new Blob([payload]).size > MAX_REQUEST_BYTES) throw new Error('Đoạn gửi vượt giới hạn máy chủ.');
  const delays = [5000, 15000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 100000);
    let response: Response, raw: string;
    try {
      response = await fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, signal: controller.signal });
      raw = await response.text();
    } catch {
      throw new Error('Kết nối hết thời gian chờ. Tiến độ đã hoàn thành được giữ; bấm tạo biên bản để tiếp tục.');
    } finally { clearTimeout(timer); }
    let data: any;
    try { data = JSON.parse(raw); } catch { data = null; }
    if (!response.ok) {
      if ([500,502,503,504,524].includes(response.status) && attempt < delays.length) {
        onStatus(`AI đang bận, thử lại sau ${delays[attempt]/1000} giây…`);
        await new Promise(resolve => setTimeout(resolve, delays[attempt])); continue;
      }
      if (response.status === 429) throw new Error('AI đã vượt hạn mức miễn phí. Tiến độ được giữ; hãy mở lại cuộc họp và tiếp tục khi hạn mức được phục hồi.');
      throw new Error(data?.error?.message || `Máy chủ báo lỗi ${response.status}. Tiến độ được giữ để tiếp tục.`);
    }
    const candidate = data?.candidates?.[0];
    if (candidate?.finishReason === 'MAX_TOKENS') throw new Error('Kết quả đoạn này bị cắt. Chưa lưu đoạn lỗi; hãy thử lại.');
    const parts = candidate?.content?.parts;
    const text = (Array.isArray(parts) ? parts : []).filter((p: any) => !p.thought).map((p: any) => p.text || '').join('');
    const parsed = parseJSONSafely(text);
    if (!parsed) throw new Error('AI trả dữ liệu sai định dạng. Đoạn lỗi chưa được lưu.');
    return parsed;
  }
  throw new Error('Không hoàn thành yêu cầu AI.');
}
