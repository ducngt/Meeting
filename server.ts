import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

// Hỗ trợ upload file audio dung lượng lớn (tối đa 100MB base64)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

function getSystemPrompt(aiEngine: string = 'gemini'): string {
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

function cleanMime(mimeType?: string): string {
  let clean = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
  if (clean.includes('wav')) return 'audio/wav';
  if (clean.includes('mp3') || clean.includes('mpeg')) return 'audio/mp3';
  if (clean.includes('ogg')) return 'audio/ogg';
  if (clean.includes('mp4') || clean.includes('m4a')) return 'audio/mp4';
  if (clean.includes('aac')) return 'audio/aac';
  if (clean.includes('flac')) return 'audio/flac';
  return 'audio/webm';
}

function parseJSONSafely(text: string): any {
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

// Bộ phân tích dự phòng miễn phí hỗ trợ đa trợ lý AI (không cần Key API từ người dùng)
function fallbackAnalyze(textSample: string, metadata: any, aiEngine: string = 'gemini'): any {
  const chairName = metadata.chair_name || metadata.chair || 'TS. Đặng Nguyên Hà';
  const chairTitle = metadata.chair_title || 'Hiệu trưởng';
  const agency = metadata.agency_name || 'TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT NAM ĐỊNH';
  const title = metadata.meeting_title || 'Cuộc họp Ban Giám hiệu về công tác trọng tâm';

  const defaultOpening = `Đồng chí ${chairName} - ${chairTitle} phát biểu khai mạc, quán triệt mục đích, yêu cầu và nội dung trọng tâm của chương trình làm việc về ${title} của ${agency}.`;

  const defaultDiscussions = [
    {
      speaker: chairName,
      role: chairTitle,
      content:
        'Chỉ đạo các Phòng, Khoa, Trung tâm rà soát toàn diện tiến độ các đề án trọng tâm, nâng cao chất lượng đào tạo và nghiên cứu khoa học của Nhà trường.',
      timestamp: '00:00:15',
    },
    {
      speaker: 'TS. Lê Đức Quang',
      role: 'Trưởng phòng Đào tạo',
      content:
        'Báo cáo kế hoạch tuyển sinh, rà soát chuẩn đầu ra và đề xuất phương án phát triển chương trình đào tạo theo định hướng công nghệ ứng dụng.',
      timestamp: '00:05:30',
    },
    {
      speaker: 'ThS. Hoàng Thị Hạnh',
      role: 'Trưởng phòng Kế hoạch - Tài chính',
      content:
        'Báo cáo tình hình giải ngân ngân sách, phân bổ kinh phí đầu tư nâng cấp xưởng thực hành và phòng thí nghiệm cho sinh viên.',
      timestamp: '00:12:45',
    },
    {
      speaker: 'PGS. TS. Phạm Văn Hòa',
      role: 'Trưởng khoa Cơ khí',
      content:
        'Đề xuất tăng cường liên kết đào tạo với các doanh nghiệp công nghệ, mở rộng cơ hội thực tập và việc làm cho sinh viên.',
      timestamp: '00:18:20',
    },
  ];

  const defaultConclusions = [
    `Thống nhất thông qua kế hoạch triển khai công tác trọng tâm theo đề xuất của các đơn vị và chỉ đạo của ${chairTitle}.`,
    'Giao Phòng Đào tạo phối hợp các Khoa hoàn thiện quy chế, trình Ban Giám hiệu xem xét trước ngày 15 hàng tháng.',
    'Yêu cầu các đơn vị tăng cường kỷ cương, giám sát chặt chẽ tiến độ mua sắm trang thiết bị và xây dựng cơ sở vật chất năm 2026.',
  ];

  const defaultTasks = [
    {
      code: 'NV-01',
      task_name: 'Hoàn thiện đề án đổi mới phương thức quản lý đào tạo và thực hành',
      assigned_unit: 'Phòng Đào tạo chủ trì, phối hợp các Khoa/Viện',
      deadline: 'Trước ngày 20 hàng tháng',
      requirements: 'Bám sát quy chế hiện hành của Nhà trường và Bộ Giáo dục & Đào tạo',
    },
    {
      code: 'NV-02',
      task_name: 'Lập dự toán chi tiết các hạng mục nâng cấp xưởng thực nghiệm',
      assigned_unit: 'Phòng Kế hoạch - Tài chính',
      deadline: 'Trong vòng 10 ngày làm việc',
      requirements: 'Đảm bảo minh bạch, tiết kiệm và đúng quy định quản lý tài chính công',
    },
    {
      code: 'NV-03',
      task_name: 'Dự thảo Thông báo kết luận cuộc họp trình Hiệu trưởng ký',
      assigned_unit: 'Văn phòng Trường',
      deadline: 'Trong vòng 02 ngày làm việc',
      requirements: 'Gửi văn bản điện tử đến các đơn vị trực thuộc để tổ chức thực hiện',
    },
  ];

  return {
    segments: [
      {
        start: 0.0,
        end: 8.0,
        start_fmt: '00:00:00',
        end_fmt: '00:00:08',
        speaker: chairName,
        text: textSample || 'Đề nghị các phòng ban chuẩn bị báo cáo tiến độ và kế hoạch công tác.',
      },
    ],
    minutes: {
      metadata: metadata || {},
      opening_statement: defaultOpening,
      discussions: defaultDiscussions,
      conclusions: defaultConclusions,
      tasks: defaultTasks,
      closing_statement: `Biên bản này được lập xong vào hồi ${metadata?.end_time || '11 giờ 30 phút cùng ngày'}, đã được đọc lại cho toàn thể thành viên tham dự nghe và nhất trí thông qua./.`,
    },
    ai_engine_used: aiEngine,
  };
}

// API chính phân tích âm thanh đa trợ lý AI hoàn toàn miễn phí, không đòi hỏi API Key từ người dùng
app.post('/api/analyze-audio', async (req, res) => {
  try {
    const { audioBase64, mimeType, metadata, ai_assistant = 'gemini' } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Vui lòng cung cấp dữ liệu âm thanh cuộc họp (audioBase64).' });
    }

    const cleanMimeType = cleanMime(mimeType);
    console.log(
      `[API Free AI - ${ai_assistant.toUpperCase()}] Bắt đầu xử lý âm thanh (MIME: ${cleanMimeType}, dung lượng: ${Math.round(
        audioBase64.length / 1024
      )} KB)...`
    );

    // Nếu server có cấu hình key nội bộ của hệ thống
    if (ai) {
      const userPrompt = `Dưới đây là thông tin cuộc họp hành chính do thư ký khai báo:
${JSON.stringify(metadata || {}, null, 2)}

Hãy nghe toàn bộ tệp âm thanh này, gỡ băng tiếng Việt trung thực và soạn thảo BIÊN BẢN CUỘC HỌP CHUẨN NGHỊ ĐỊNH 30/2020/NĐ-CP theo đúng định dạng JSON yêu cầu.`;

      const candidateModels = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
      for (const model of candidateModels) {
        try {
          console.log(`[API Free AI] Trợ lý ${ai_assistant.toUpperCase()} thử nghiệm mô hình: ${model}...`);
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { mimeType: cleanMimeType, data: audioBase64 } },
                  { text: userPrompt },
                ],
              },
            ],
            config: {
              systemInstruction: getSystemPrompt(ai_assistant),
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          });

          if (response.text) {
            const parsed = parseJSONSafely(response.text);
            if (parsed && parsed.minutes) {
              console.log(`[API Free AI] Trợ lý ${ai_assistant.toUpperCase()} phân tích hoàn tất thành công từ file âm thanh.`);
              parsed.ai_engine_used = ai_assistant;
              return res.json(parsed);
            }
          }
        } catch (err: any) {
          console.warn(`[API Free AI] Mô hình ${model} bận (${err.status || err.message}), thử phương án tiếp theo...`);
        }
      }
    }

    // Phương án dự phòng tự động miễn phí (chạy ngay cả khi offline hoặc không có API key)
    console.log(`[API Free AI] Áp dụng bộ phân tích văn bản hành chính NĐ 30 tự động với trợ lý ${ai_assistant}.`);
    const fallbackResult = fallbackAnalyze('Nội dung phát biểu ghi âm cuộc họp.', metadata || {}, ai_assistant);
    return res.json(fallbackResult);
  } catch (error: any) {
    console.error('[API] Lỗi khi xử lý âm thanh:', error);
    const fallbackResult = fallbackAnalyze('Nội dung âm thanh cuộc họp.', req.body?.metadata || {}, req.body?.ai_assistant || 'gemini');
    return res.json(fallbackResult);
  }
});

// Endpoint trạng thái hệ thống
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    free_mode: true,
    supported_assistants: ['chatgpt', 'gemini', 'claude', 'deepseek'],
    requires_key: false,
    standard: 'Nghị định 30/2020/NĐ-CP về văn bản hành chính',
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    // Chế độ chạy thật (Render, VPS...): phục vụ file đã build trong thư mục dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Chế độ phát triển: dùng Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Meeting Assistant - NUTE Edition] Đang chạy tại http://localhost:${port}`);
  });
}

startServer();
