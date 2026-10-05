const MAX_BODY_BYTES = 20 * 1024 * 1024;
export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || 'https://ducngt.github.io';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
    };
    const reply = (error, status) => new Response(JSON.stringify({ error: { message: error } }), {
      status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
    });
    if (request.headers.get('Origin') !== origin) return reply('Nguồn truy cập không được phép.', 403);
    if (new URL(request.url).pathname !== '/analyze') return reply('Không tìm thấy đường dẫn.', 404);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply('Chỉ hỗ trợ POST.', 405);
    if (!env.GEMINI_API_KEY) return reply('Quản trị viên chưa cấu hình key trên Worker.', 503);
    if (!request.headers.get('Content-Type')?.includes('application/json')) return reply('Cần dữ liệu JSON.', 415);
    const size = Number(request.headers.get('Content-Length') || 0);
    if (size > MAX_BODY_BYTES) return reply('Bản ghi quá lớn. Hãy chia nhỏ hoặc nén âm thanh.', 413);
    const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) return reply('Tên mô hình trong Worker không hợp lệ.', 503);
    // Chuyển tiếp theo luồng để không parse/copy toàn bộ base64 trong Worker Free.
    let received = 0;
    let oversized = false;
    const limited = request.body?.pipeThrough(new TransformStream({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > MAX_BODY_BYTES) {
          oversized = true;
          controller.error(new Error('Body too large'));
          return;
        }
        controller.enqueue(chunk);
      }
    }));
    if (!limited) return reply('Không có dữ liệu âm thanh.', 400);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body: limited,
          signal: AbortSignal.timeout(85000)
        }
      );
      return new Response(response.body, {
        status: response.status,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
      });
    } catch {
      return reply(oversized ? 'Bản ghi quá lớn.' : 'Không kết nối được Gemini hoặc xử lý quá thời gian. Tiến độ được giữ; hãy thử tiếp tục.', oversized ? 413 : 502);
    }
  }
};
