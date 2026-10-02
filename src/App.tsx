/**
 * Meeting Assistant - Trường Đại học Sư phạm Kỹ thuật Nam Định (NUTE)
 * Hệ thống trợ lý ghi âm và soạn thảo Biên bản cuộc họp
 * Hỗ trợ đa Trợ lý AI (ChatGPT, Gemini, Claude, DeepSeek) không cần Key API
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Upload,
  FileText,
  Download,
  Copy,
  Check,
  Building,
  RotateCcw,
  Loader2,
  Trash2,
  Printer,
  Clock,
  UserCheck,
  Users,
  Plus,
  MapPin,
  User,
  Bot,
  Edit3,
} from 'lucide-react';

import { AdministrativeMinutes, MeetingMetadata, TranscriptSegment, AttendeeItem } from './types';
import { DEFAULT_METADATA, DEFAULT_ATTENDEES } from './sampleData';
import { getSupportedMimeType } from './audioUtils';
import { generateWordDocument, downloadWordDocument } from './wordGenerator';
import { NuteLogo } from './NuteLogo';

interface AiAssistantOption {
  id: 'chatgpt' | 'gemini' | 'claude' | 'deepseek';
  name: string;
  provider: string;
  description: string;
  badge: string;
  color: string;
  borderActive: string;
  iconBg: string;
}

const AI_ASSISTANTS: AiAssistantOption[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    provider: 'OpenAI',
    description: 'Văn phong hành chính trang trọng, súc tích, mạch lạc và bám sát quy chuẩn văn thư.',
    badge: 'Chuyên văn bản',
    color: 'text-emerald-700',
    borderActive: 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20',
    iconBg: 'bg-emerald-600',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    provider: 'Google',
    description: 'Mở website Gemini để cung cấp nội dung và yêu cầu soạn biên bản.',
    badge: 'Tốc độ cao',
    color: 'text-blue-700',
    borderActive: 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20',
    iconBg: 'bg-blue-600',
  },
  {
    id: 'claude',
    name: 'Claude',
    provider: 'Anthropic',
    description: 'Lập luận logic chặt chẽ, tổng hợp thấu đáo các luồng ý kiến thảo luận và kết luận chỉ đạo.',
    badge: 'Lập luận sâu sắc',
    color: 'text-purple-700',
    borderActive: 'border-purple-500 bg-purple-50/40 ring-2 ring-purple-500/20',
    iconBg: 'bg-purple-600',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek AI',
    provider: 'DeepSeek',
    description: 'Bóc tách trách nhiệm chi tiết, thiết lập ma trận phân công công việc và rà soát tiến độ tối ưu.',
    badge: 'Phân công nhiệm vụ',
    color: 'text-indigo-700',
    borderActive: 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/20',
    iconBg: 'bg-indigo-600',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'metadata' | 'document' | 'export'>('pipeline');

  const [metadata, setMetadata] = useState<MeetingMetadata>(DEFAULT_METADATA);
  const [attendeeList, setAttendeeList] = useState<AttendeeItem[]>(DEFAULT_ATTENDEES);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [minutes, setMinutes] = useState<AdministrativeMinutes | null>(null);

  const [selectedAi, setSelectedAi] = useState<'chatgpt' | 'gemini' | 'claude' | 'deepseek'>('chatgpt');
  const [aiResult, setAiResult] = useState('');
  const [notice, setNotice] = useState('');
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isStoppingRecording, setIsStoppingRecording] = useState(false);
  const aiUrls = {
    chatgpt: 'https://chatgpt.com/',
    gemini: 'https://gemini.google.com/',
    claude: 'https://claude.ai/',
    deepseek: 'https://chat.deepseek.com/',
  };

  // Thu âm microphone
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([15, 25, 40, 60, 40, 20, 35, 50, 65, 45, 25, 15]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Trạng thái xử lý
  const streamRef = useRef<MediaStream | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const recordingBusyRef = useRef(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);

  // Form thêm đại biểu mới
  const [newAttendee, setNewAttendee] = useState({
    name: '',
    role: 'Trưởng phòng',
    department: 'Phòng chức năng',
  });

  const releaseCapture = () => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = null;
    if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    analyserRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        recorder.onerror = null;
        if (recorder.state !== 'inactive') recorder.stop();
      }
      releaseCapture();
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
    };
  }, []);

  const setAudioSource = (blob: Blob, name: string) => {
    if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
    const url = URL.createObjectURL(blob);
    currentUrlRef.current = url;
    setAudioBlob(blob);
    setAudioUrl(url);
    setAudioFileName(name);
    setMinutes(null);
    setSegments([]);
    setAiResult('');
  };

  const audioExtension = (mime: string) => {
    const type = mime.toLowerCase();
    if (type.includes('mp4') || type.includes('aac')) return 'm4a';
    if (type.includes('ogg')) return 'ogg';
    if (type.includes('wav')) return 'wav';
    if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
    if (type.includes('flac')) return 'flac';
    return 'webm';
  };

  const startRecording = async () => {
    if (recordingBusyRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordError('Trình duyệt không hỗ trợ ghi âm. Hãy dùng HTTPS hoặc tải tệp âm thanh lên.');
      return;
    }
    recordingBusyRef.current = true;
    setIsStartingRecording(true);
    setRecordError(null);
    setNotice('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        recordingBusyRef.current = false;
        return;
      }
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        releaseCapture();
        recordingBusyRef.current = false;
        if (!mountedRef.current) return;
        setIsRecording(false);
        setIsStoppingRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) {
          setRecordError('Bản ghi không có dữ liệu. Hãy kiểm tra microphone và ghi lại.');
          return;
        }
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        setAudioSource(blob, `Ghi_am_hop_NUTE_${stamp}.${audioExtension(blob.type)}`);
        setNotice('Đã tạo bản ghi trong phiên này. Hãy tải tệp về trước khi đóng hoặc tải lại trang.');
      };
      recorder.onerror = () => {
        setRecordError('Có lỗi ghi âm. Hãy tải phần bản ghi đã thu được nếu có.');
        if (recorder.state !== 'inactive') recorder.stop();
        releaseCapture();
        recordingBusyRef.current = false;
        setIsRecording(false);
        setIsStoppingRecording(false);
      };
      recorder.start(1000);
      setRecordDuration(0);
      setIsRecording(true);
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        setRecordDuration(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const context = new AudioCtx();
          audioContextRef.current = context;
          void context.resume().catch(() => {});
          const analyser = context.createAnalyser();
          analyser.fftSize = 64;
          context.createMediaStreamSource(stream).connect(analyser);
          analyserRef.current = analyser;
          const values = new Uint8Array(analyser.frequencyBinCount);
          const updateLevels = () => {
            if (!analyserRef.current || !mountedRef.current) return;
            analyser.getByteFrequencyData(values);
            setAudioLevels(Array.from({ length: 12 }, (_, i) =>
              Math.max(5, Math.round(values[i * 2] / 255 * 100))
            ));
            animFrameRef.current = requestAnimationFrame(updateLevels);
          };
          updateLevels();
        }
      } catch { /* Ghi âm vẫn hoạt động khi không có biểu đồ âm thanh. */ }
    } catch (error) {
      releaseCapture();
      recordingBusyRef.current = false;
      const name = error instanceof Error ? error.name : '';
      setRecordError(name === 'NotAllowedError'
        ? 'Microphone bị từ chối. Hãy cấp quyền trong trình duyệt hoặc tải tệp âm thanh lên.'
        : `Không thể ghi âm: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
      setIsRecording(false);
    } finally {
      if (mountedRef.current) setIsStartingRecording(false);
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    setIsStoppingRecording(true);
    recorder.stop();
    // Đợi onstop nhận khối âm thanh cuối rồi giải phóng microphone.
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || recordingBusyRef.current) return;
    if (!file.size) { setRecordError('Tệp âm thanh rỗng.'); return; }
    if (!file.type.startsWith('audio/') && !/\.(wav|mp3|m4a|mp4|ogg|flac|webm|aac)$/i.test(file.name)) {
      setRecordError('Hãy chọn tệp âm thanh được hỗ trợ.');
      return;
    }
    setAudioSource(file, file.name);
    setRecordDuration(0);
    setRecordError(null);
    setNotice('Tệp đã được chọn trên máy của bạn; chưa gửi tới dịch vụ AI.');
  };

  const handleResetSession = () => {
    if (recordingBusyRef.current) {
      setRecordError('Hãy dừng ghi âm và đợi bản ghi hoàn tất trước khi tạo cuộc họp mới.');
      return;
    }
    if ((audioBlob || minutes || aiResult) && !window.confirm('Xóa bản ghi và nội dung trong phiên này? Hãy tải các tệp cần giữ trước.')) return;
    if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
    currentUrlRef.current = null;
    setSegments([]);
    setMinutes(null);
    setAudioUrl(null);
    setAudioBlob(null);
    setAudioFileName('');
    setAiResult('');
    setRecordDuration(0);
    setRecordError(null);
    setNotice('Đã xóa nội dung. Thông tin cơ quan và đại biểu được giữ để bạn cập nhật tại Tab 2.');
    setActiveTab('pipeline');
  };

  const handleCreateEmptyMinutes = () => {
    setAiResult(JSON.stringify({
      opening_statement: '', discussions: [], conclusions: [], tasks: [], closing_statement: ''
    }, null, 2));
    setActiveTab('pipeline');
    setNotice('Đã tạo cấu trúc JSON trống. Nhập nội dung vào ô kết quả rồi nhấn Nhập kết quả vào biên bản.');
  };

  const handleAnalyzeAudio = () => {
    window.open(aiUrls[selectedAi], '_blank', 'noopener,noreferrer');
  };

  const handleDownloadAudio = () => {
    if (!audioBlob || recordingBusyRef.current) return;
    const url = URL.createObjectURL(audioBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = audioBlob instanceof File ? audioBlob.name
      : audioFileName || `ghi-am-cuoc-hop.${audioExtension(audioBlob.type)}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const buildPrompt = () => {
    const structure = {
      opening_statement: '',
      discussions: [{ speaker: '', role: '', content: '', timestamp: '' }],
      conclusions: [],
      tasks: [{ code: '', task_name: '', assigned_unit: '', deadline: '', requirements: '' }],
      closing_statement: ''
    };
    return [
      'Soạn biên bản bằng tiếng Việt từ âm thanh hoặc bản chép lời tôi cung cấp.',
      'Chỉ trả về một đối tượng JSON hợp lệ đúng cấu trúc dưới đây, không dùng khối Markdown.',
      'Không bịa người phát biểu, quyết định, nhiệm vụ, thời hạn, giờ họp hoặc việc thông qua biên bản.',
      'Không xác định được người nói thì ghi "Chưa xác định". Thông tin thiếu để chuỗi rỗng; danh sách không có dữ liệu để [].',
      'Phân biệt ý kiến đề xuất với quyết định đã được chủ trì kết luận.',
      'Các đối tượng mẫu dưới đây chỉ mô tả trường dữ liệu, không phải nội dung cuộc họp.',
      'Nếu không đọc được nguồn, hãy báo rõ và yêu cầu bản chép lời; không tạo biên bản suy đoán.',
      'Thông tin cuộc họp do tôi khai báo:', JSON.stringify(metadata, null, 2),
      'Cấu trúc JSON cần trả về:', JSON.stringify(structure, null, 2)
    ].join('\n\n');
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildPrompt());
      setNotice('Đã sao chép yêu cầu. Mở website AI, dán yêu cầu và cung cấp âm thanh hoặc bản chép lời.');
    } catch {
      setNotice('Không sao chép được. Hãy mở Yêu cầu gửi AI bên dưới và sao chép thủ công.');
    }
  };

  const handleImportAiResult = () => {
    try {
      const cleaned = aiResult.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);
      const data = parsed?.minutes ?? parsed;
      const hasStrings = (value: any, fields: string[]) =>
        value !== null && typeof value === 'object' && !Array.isArray(value) &&
        fields.every(field => typeof value[field] === 'string');
      if (
        !hasStrings(data, ['opening_statement', 'closing_statement']) ||
        !Array.isArray(data.discussions) ||
        !data.discussions.every((item: any) =>
          hasStrings(item, ['speaker', 'content']) &&
          (item.role === undefined || typeof item.role === 'string') &&
          (item.timestamp === undefined || typeof item.timestamp === 'string')) ||
        !Array.isArray(data.conclusions) ||
        !data.conclusions.every((item: any) => typeof item === 'string') ||
        !Array.isArray(data.tasks) ||
        !data.tasks.every((item: any) =>
          hasStrings(item, ['code', 'task_name', 'assigned_unit', 'deadline']) &&
          (item.requirements === undefined || typeof item.requirements === 'string'))
      ) throw new Error('JSON chưa đúng cấu trúc. Hãy yêu cầu AI sửa theo mẫu yêu cầu.');
      setMinutes({ metadata, opening_statement: data.opening_statement,
        discussions: data.discussions, conclusions: data.conclusions,
        tasks: data.tasks, closing_statement: data.closing_statement });
      setSegments([]);
      setRecordError(null);
      setNotice('Đã nhập kết quả. Hãy đối chiếu nội dung với nguồn trước khi xuất Word.');
      setActiveTab('document');
    } catch (error) {
      setNotice(`Không nhập được: ${error instanceof Error ? error.message : 'JSON không hợp lệ'}`);
    }
  };

  // Đồng bộ thông tin khai báo vào biên bản đã nhập để xuất Word và xem trước thống nhất.
  useEffect(() => {
    setMinutes(previous => previous ? { ...previous, metadata } : previous);
  }, [metadata]);

  // Xuất file Word (.docx)
  const handleDownloadWord = async () => {
    if (!minutes) {
      alert('Chưa có nội dung biên bản cuộc họp. Vui lòng ghi âm và soạn thảo tại Tab 1 trước khi xuất file Word.');
      return;
    }
    setIsExportingWord(true);
    try {
      const blob = await generateWordDocument(minutes);
      const filename = `Bien_ban_hop_NUTE_${metadata.document_code.replace(/[^a-zA-Z0-9]/g, '_') || 'cuoc_hop'}.docx`;
      downloadWordDocument(blob, filename);
    } catch (e: any) {
      console.error('Lỗi khi sinh file Word:', e);
      alert('Có lỗi khi tạo tệp Word: ' + (e.message || e));
    } finally {
      setIsExportingWord(false);
    }
  };

  // Sao chép nội dung văn bản
  const handleCopyDocumentText = async () => {
    if (!minutes) return;
    const text = `
${metadata.superior_agency.toUpperCase()}
${metadata.agency_name.toUpperCase()}
${metadata.document_code}
----------------------------
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
----------------------------
${metadata.location_date}

BIÊN BẢN
${metadata.meeting_title.toUpperCase()}

I. THỜI GIAN, ĐỊA ĐIỂM
- Thời gian: Bắt đầu từ ${metadata.start_time}, kết thúc hồi ${metadata.end_time}.
- Địa điểm: ${metadata.location}

II. THÀNH PHẦN THAM DỰ
1. Chủ trì cuộc họp: ${metadata.chair_name} - ${metadata.chair_title} (${metadata.chair_unit})
2. Thư ký cuộc họp: ${metadata.secretary_name} - ${metadata.secretary_title} (${metadata.secretary_unit})
3. Số lượng đại biểu: Tổng số triệu tập ${metadata.total_invited} đồng chí; Có mặt: ${metadata.total_present} đồng chí; Vắng mặt: ${metadata.total_absent} đồng chí.
4. Danh sách đại biểu dự: ${metadata.attendees_summary || '(Theo danh sách triệu tập và điểm danh cuộc họp).'}
5. Đại biểu vắng mặt: ${metadata.absentees_detail}

III. NỘI DUNG VÀ DIỄN BIẾN CUỘC HỌP
1. Quán triệt của Chủ trì cuộc họp:
${minutes.opening_statement}

2. Ý kiến phát biểu và thảo luận của các thành viên dự họp:
${minutes.discussions.map((d, i) => `- Ý kiến ${i + 1} (${d.speaker}${d.role ? ` - ${d.role}` : ''}): ${d.content}`).join('\n')}

IV. KẾT LUẬN CỦA CHỦ TRÌ CUỘC HỌP
${minutes.conclusions.map((c, i) => `${i + 1}. ${c}`).join('\n')}

BẢNG PHÂN CÔNG NHIỆM VỤ:
${minutes.tasks.map((t, i) => `${i + 1}. ${t.task_name} | Đơn vị: ${t.assigned_unit} | Hạn: ${t.deadline}`).join('\n')}

${minutes.closing_statement}

        THƯ KÝ CUỘC HỌP                        CHỦ TRÌ CUỘC HỌP
      (Ký và ghi rõ họ tên)                  (Ký và ghi rõ họ tên)


      ${metadata.secretary_name}              ${metadata.chair_name}

Nơi nhận:
- Ban Giám hiệu (để báo cáo);
- Các đơn vị trực thuộc (để thực hiện);
- Lưu: VT, Hồ sơ cuộc họp.
    `.trim();

    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      setNotice('Không sao chép được nội dung. Hãy kiểm tra quyền Clipboard.');
    }
  };

  // Thêm đại biểu mới vào danh sách
  const handleAddAttendee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttendee.name.trim()) return;
    const added: AttendeeItem = {
      id: Date.now().toString(),
      name: newAttendee.name.trim(),
      role: newAttendee.role.trim() || 'Thành viên',
      department: newAttendee.department.trim() || 'Đơn vị',
      present: true,
    };
    const nextList = [...attendeeList, added];
    setAttendeeList(nextList);
    setNewAttendee({ name: '', role: 'Trưởng phòng', department: 'Phòng chức năng' });

    const summary = nextList.map((a) => `${a.name} (${a.role} - ${a.department})`).join(', ');
    const presentCount = nextList.filter((a) => a.present).length;
    const absentCount = nextList.filter((a) => !a.present).length;

    setMetadata((prev) => ({
      ...prev,
      total_invited: prev.total_invited > 0 ? prev.total_invited + 1 : nextList.length,
      total_present: prev.total_present > 0 ? prev.total_present + 1 : presentCount,
      total_absent: absentCount,
      attendees_summary: summary,
      attendee_list: nextList,
    }));
  };

  // Xóa đại biểu
  const handleRemoveAttendee = (id: string) => {
    const nextList = attendeeList.filter((a) => a.id !== id);
    setAttendeeList(nextList);
    const summary = nextList.map((a) => `${a.name} (${a.role} - ${a.department})`).join(', ');
    const presentCount = nextList.filter((a) => a.present).length;
    const absentCount = nextList.filter((a) => !a.present).length;

    setMetadata((prev) => ({
      ...prev,
      total_invited: Math.max(0, prev.total_invited > 0 ? prev.total_invited - 1 : nextList.length),
      total_present: Math.max(0, prev.total_present > 0 ? prev.total_present - (attendeeList.find(a => a.id === id)?.present ? 1 : 0) : presentCount),
      total_absent: absentCount,
      attendees_summary: summary,
      attendee_list: nextList,
    }));
  };

  // Bật/tắt có mặt của đại biểu
  const handleToggleAttendance = (id: string) => {
    const nextList = attendeeList.map((a) => (a.id === id ? { ...a, present: !a.present } : a));
    setAttendeeList(nextList);
    const presentCount = nextList.filter((a) => a.present).length;
    const absentCount = nextList.filter((a) => !a.present).length;
    const absentees = nextList
      .filter((a) => !a.present)
      .map((a) => `${a.name} (${a.role} - ${a.department})${a.absentReason ? `: ${a.absentReason}` : ''}`)
      .join('; ');

    setMetadata((prev) => ({
      ...prev,
      total_present: presentCount,
      total_absent: absentCount,
      absentees_detail: absentees || 'Không có (Có mặt đầy đủ).',
      attendee_list: nextList,
    }));
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* HEADER TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT NAM ĐỊNH */}
      <header className="bg-[#0A1E60] text-white shadow-md border-b-4 border-[#FEE000] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* LOGO CHÍNH THỨC CỦA NUTE */}
            <div className="w-12 h-12 rounded-full bg-white p-0.5 shadow-md flex items-center justify-center shrink-0">
              <NuteLogo className="w-11 h-11" />
            </div>

            <div className="min-w-0">
              <h1 className="font-extrabold text-sm sm:text-base md:text-lg tracking-tight text-white uppercase whitespace-nowrap">
                TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT NAM ĐỊNH
              </h1>
              <p className="text-xs text-amber-200 font-medium whitespace-nowrap">
                Hệ thống trợ lý ghi âm và soạn thảo Biên bản cuộc họp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
            <button
              onClick={handleResetSession}
              className="text-xs px-3 py-1.5 rounded bg-blue-900/80 hover:bg-blue-800 text-slate-100 border border-blue-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Xóa trắng dữ liệu để bắt đầu cuộc họp mới"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Cuộc họp mới
            </button>

            <button
              onClick={handleDownloadWord}
              disabled={isExportingWord || !minutes}
              className="text-xs px-4 py-1.5 rounded bg-[#FEE000] hover:bg-yellow-400 text-[#0A1E60] font-bold transition flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
            >
              {isExportingWord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-[#0A1E60]" />}
              Tải file Word (.docx)
            </button>
          </div>
        </div>

        {/* THANH ĐIỀU HƯỚNG TABS */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 overflow-x-auto border-t border-blue-900/60 pt-1">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'pipeline'
                ? 'border-[#FEE000] text-yellow-300 bg-blue-950/60 font-bold'
                : 'border-transparent text-slate-200 hover:text-white hover:border-slate-400'
            }`}
          >
            <Mic className="w-4 h-4" />
            1. Ghi âm & Trao đổi với AI
            {audioBlob && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
          </button>

          <button
            onClick={() => setActiveTab('metadata')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'metadata'
                ? 'border-[#FEE000] text-yellow-300 bg-blue-950/60 font-bold'
                : 'border-transparent text-slate-200 hover:text-white hover:border-slate-400'
            }`}
          >
            <Users className="w-4 h-4" />
            2. Thông tin & Danh sách đại biểu dự
            {attendeeList.length > 0 && <span className="text-[11px] font-mono bg-blue-900/60 px-1.5 py-0.5 rounded">({attendeeList.length})</span>}
          </button>

          <button
            onClick={() => setActiveTab('document')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'document'
                ? 'border-[#FEE000] text-yellow-300 bg-blue-950/60 font-bold'
                : 'border-transparent text-slate-200 hover:text-white hover:border-slate-400'
            }`}
          >
            <FileText className="w-4 h-4" />
            Biên bản họp
            {minutes && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'export'
                ? 'border-[#FEE000] text-yellow-300 bg-blue-950/60 font-bold'
                : 'border-transparent text-slate-200 hover:text-white hover:border-slate-400'
            }`}
          >
            <Download className="w-4 h-4" />
            4. Xuất Biên bản Word (.docx)
          </button>
        </div>
      </header>

      {/* NỘI DUNG CHÍNH */}
      {notice && <div role="status" className="no-print max-w-7xl mx-auto w-full px-4 pt-4 text-sm text-blue-900">{notice}</div>}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* BANNER THÔNG TIN TRƯỜNG ĐH SPKT NAM ĐỊNH */}
        <div className="mb-6 bg-white border-l-4 border-[#0A1E60] rounded-r-lg p-3.5 shadow-sm text-xs sm:text-sm text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <NuteLogo className="w-8 h-8 shrink-0" />
            <div>
              <span className="font-bold text-[#0A1E60]">
                Trường Đại học Sư phạm Kỹ thuật Nam Định:
              </span>{' '}
              Hệ thống ghi âm và hỗ trợ soạn thảo biên bản họp phục vụ Hội nghị
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium shrink-0">
            Địa điểm: {metadata.location}
          </div>
        </div>

        {/* TAB 1: GHI ÂM, GỠ BĂNG & CHỌN TRỢ LÝ AI */}
        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            {/* LỰA CHỌN TRỢ LÝ AI (Hộp sổ để chọn) */}
            <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-[#0A1E60]" />
                  <label htmlFor="ai-assistant-select" className="font-bold text-sm sm:text-base text-[#0A1E60] uppercase">
                    Lựa chọn Trợ lý AI phân tích & soạn thảo biên bản
                  </label>
                </div>

                <div className="w-full md:w-96">
                  <select
                    id="ai-assistant-select"
                    value={selectedAi}
                    onChange={(e) => setSelectedAi(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg font-bold text-[#0A1E60] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0A1E60] focus:bg-white transition cursor-pointer"
                  >
                    {AI_ASSISTANTS.map((ai) => (
                      <option key={ai.id} value={ai.id}>
                        {ai.name} ({ai.provider}) - {ai.badge}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Thông tin trợ lý đang được chọn */}
              <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200 flex items-center justify-between text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#0A1E60]">
                    Trợ lý đang chọn: {AI_ASSISTANTS.find((a) => a.id === selectedAi)?.name} ({AI_ASSISTANTS.find((a) => a.id === selectedAi)?.provider})
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-600 hidden sm:inline">
                    {AI_ASSISTANTS.find((a) => a.id === selectedAi)?.description}
                  </span>
                </div>
                <span className="font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded text-[11px] shrink-0">
                  {AI_ASSISTANTS.find((a) => a.id === selectedAi)?.badge}
                </span>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-3">
                <p className="text-sm text-blue-900">
                  Không cần API key. Nhập thông tin tại Tab 2, tải bản ghi về, mở website AI và tự cung cấp nội dung.
                  Nếu dịch vụ không nhận âm thanh, hãy dùng bản chép lời. Dán JSON kết quả vào ô bên dưới.
                  Ứng dụng không tự gửi dữ liệu hoặc tự lấy kết quả từ AI.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleDownloadAudio}
                    disabled={!audioBlob || isRecording || isStartingRecording || isStoppingRecording}
                    className="border rounded px-3 py-2 bg-white text-sm disabled:opacity-50">1. Tải bản ghi âm</button>
                  <button type="button" onClick={handleCopyPrompt}
                    className="border rounded px-3 py-2 bg-white text-sm">2. Sao chép yêu cầu</button>
                  <button type="button" onClick={handleAnalyzeAudio}
                    className="border rounded px-3 py-2 bg-white text-sm">3. Mở website AI</button>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold">Yêu cầu gửi AI (có thể sao chép thủ công)</summary>
                  <textarea readOnly value={buildPrompt()} rows={8} aria-label="Yêu cầu gửi AI"
                    className="mt-2 w-full border rounded p-2 bg-white font-mono text-xs" />
                </details>
                <label htmlFor="ai-result" className="block text-sm font-semibold">4. Dán JSON do AI trả về</label>
                <textarea id="ai-result" value={aiResult} onChange={event => setAiResult(event.target.value)} rows={10}
                  placeholder="Dán toàn bộ JSON kết quả vào đây..." className="w-full border rounded p-2 font-mono text-sm bg-white" />
                <button type="button" onClick={handleImportAiResult} disabled={!aiResult.trim()}
                  className="bg-blue-900 text-white rounded px-3 py-2 text-sm disabled:opacity-50">5. Nhập kết quả vào biên bản</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cột 1: Thu âm microphone hoặc tải file */}
              <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-5 space-y-5">
                <h3 className="font-bold text-base text-[#0A1E60] flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Mic className="w-5 h-5 text-red-600" />
                  Ghi âm cuộc họp / Hội nghị
                </h3>

                {/* Microphone Record Card */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center space-y-3.5">
                  {recordError && (
                    <div className="bg-amber-50 border border-amber-300 rounded p-2.5 text-xs text-amber-900 text-left space-y-1.5">
                      <div className="flex items-start gap-1.5 font-semibold">
                        <span>{recordError}</span>
                      </div>
                    </div>
                  )}

                  {/* Vòng tròn ghi âm & Animation sóng âm */}
                  <div className="flex items-center justify-center">
                    {isRecording ? (
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/40 animate-pulse">
                          <Mic className="w-8 h-8" />
                        </div>
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-white"></span>
                        </span>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center">
                        <Mic className="w-8 h-8 text-slate-500" />
                      </div>
                    )}
                  </div>

                  {/* Sóng âm thanh */}
                  {isRecording ? (
                    <div className="space-y-1">
                      <div className="flex items-end justify-center gap-1.5 h-10 px-2 bg-slate-100 rounded border border-slate-200 py-1">
                        {audioLevels.map((lvl, idx) => (
                          <div
                            key={idx}
                            style={{ height: `${lvl}%` }}
                            className="w-1.5 bg-red-600 rounded-t transition-all duration-75"
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-red-600 font-semibold animate-pulse">
                        Đang ghi âm tín hiệu cuộc họp...
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Thu âm trực tiếp từ micro phòng họp hoặc máy tính
                    </p>
                  )}

                  <div className="font-mono text-2xl font-bold text-slate-800 tracking-wider">
                    {formatTimer(recordDuration)}
                  </div>

                  {/* Nút bấm Ghi âm */}
                  <div>
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        disabled={isStartingRecording || isStoppingRecording}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold flex items-center justify-center gap-2 shadow transition cursor-pointer"
                      >
                        <Mic className="w-4 h-4" />
                        {isStartingRecording ? 'Đang xin quyền microphone...' : isStoppingRecording ? 'Đang hoàn tất bản ghi...' : 'Bắt đầu ghi âm cuộc họp'}
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        disabled={isStoppingRecording}
                        className="w-full py-2.5 bg-slate-900 hover:bg-black text-white rounded text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition"
                      >
                        <MicOff className="w-4 h-4 text-red-400" />
                        Dừng ghi âm & Tạo bản ghi
                      </button>
                    )}
                  </div>
                </div>

                {/* Upload File Audio */}
                <div className="border-t border-slate-200 pt-4 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Hoặc tải lên tệp ghi âm cuộc họp (.wav, .mp3, .m4a):
                  </label>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-[#0A1E60] rounded-lg p-3.5 cursor-pointer bg-slate-50 hover:bg-slate-100 transition">
                    <Upload className="w-5 h-5 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-600 font-medium">Nhấn để chọn tệp âm thanh cuộc họp</span>
                    <span className="text-[11px] text-slate-400">Hỗ trợ tệp ghi âm điện thoại, máy ghi âm hội trường</span>
                    <input type="file" accept="audio/*,.m4a,.webm,.mp4" disabled={isRecording || isStartingRecording || isStoppingRecording} onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                {/* Audio Player Preview */}
                {audioUrl && (
                  <div className="border-t border-slate-200 pt-4 space-y-2.5 bg-blue-50/50 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5 truncate max-w-[200px]" title={audioFileName}>
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        {audioFileName || 'Tệp ghi âm cuộc họp'}
                      </span>
                      <button onClick={handleResetSession} className="text-xs text-red-600 hover:text-red-700 p-1 cursor-pointer" title="Hủy file">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <audio ref={audioPlayerRef} src={audioUrl} controls className="w-full h-8 rounded" />

                    <button onClick={handleDownloadAudio} className="w-full py-2 bg-blue-900 text-white rounded text-sm">
                      Tải bản ghi âm về máy
                    </button>
                  </div>
                )}
              </div>

              {/* Cột 2 & 3: Nhật ký gỡ băng & Lời thoại */}
              <div className="lg:col-span-2 bg-white rounded-lg border border-slate-300 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="font-bold text-base text-[#0A1E60] flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Lời thoại cuộc họp ({segments.length} phân đoạn)
                  </h3>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded font-mono">
                    Trao đổi với AI trên website riêng
                  </span>
                </div>

                {segments.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50 space-y-3">
                    <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm text-slate-600 font-medium">Chưa có dữ liệu lời thoại cuộc họp</p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Ứng dụng không tự gỡ băng. Cung cấp nguồn trên website AI và nhập JSON biên bản bằng khung phía trên. Bản chép lời được xử lý riêng trên website AI.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {segments.map((seg, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 hover:bg-blue-50/40 rounded-lg border border-slate-200 transition space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">{seg.speaker}</span>
                          <span className="font-mono text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded text-[11px]">
                            {seg.start_fmt} - {seg.end_fmt}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{seg.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: THÔNG TIN & DANH SÁCH ĐẠI BIỂU DỰ */}
        {activeTab === 'metadata' && (
          <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-6 space-y-8">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-[#0A1E60] flex items-center gap-2">
                  <Building className="w-5 h-5 text-amber-500" />
                  Khai báo Thông tin & Danh sách đại biểu dự cuộc họp
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Nhập họ tên, chức danh của Hiệu trưởng, Thư ký, số lượng đại biểu và danh sách đại biểu dự họp.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('document')}
                className="px-4 py-2 bg-[#0A1E60] hover:bg-blue-900 text-white rounded text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
              >
                <span>Xem Biên bản họp</span>
                <Check className="w-4 h-4" />
              </button>
            </div>

            {/* KHỐI 1: CƠ QUAN & THỜI GIAN, ĐỊA ĐIỂM */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-[#0A1E60] uppercase border-b border-slate-200 pb-1 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                1. Thông tin văn bản, thời gian và địa điểm
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Cơ quan chủ quản cấp trên:</label>
                  <input
                    type="text"
                    value={metadata.superior_agency}
                    onChange={(e) => setMetadata({ ...metadata, superior_agency: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-[#0A1E60] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Cơ quan ban hành:</label>
                  <input
                    type="text"
                    value={metadata.agency_name}
                    onChange={(e) => setMetadata({ ...metadata, agency_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded font-semibold text-[#0A1E60] focus:ring-2 focus:ring-[#0A1E60] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Số ký hiệu biên bản:</label>
                  <input
                    type="text"
                    value={metadata.document_code}
                    onChange={(e) => setMetadata({ ...metadata, document_code: e.target.value })}
                    placeholder="Số: .../BB-ĐHSPKTNĐ"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded font-mono focus:ring-2 focus:ring-[#0A1E60] focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Tên cuộc họp / Trích yếu nội dung:</label>
                  <input
                    type="text"
                    value={metadata.meeting_title}
                    onChange={(e) => setMetadata({ ...metadata, meeting_title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded font-bold text-slate-900 focus:ring-2 focus:ring-[#0A1E60] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Địa danh, ngày tháng:</label>
                  <input
                    type="text"
                    value={metadata.location_date}
                    onChange={(e) => setMetadata({ ...metadata, location_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-[#0A1E60] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Thời gian bắt đầu:</label>
                  <input
                    type="text"
                    value={metadata.start_time}
                    onChange={(e) => setMetadata({ ...metadata, start_time: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-[#0A1E60] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Thời gian kết thúc:</label>
                  <input
                    type="text"
                    value={metadata.end_time}
                    onChange={(e) => setMetadata({ ...metadata, end_time: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-[#0A1E60] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Địa điểm diễn ra cuộc họp:</label>
                  <input
                    type="text"
                    value={metadata.location}
                    onChange={(e) => setMetadata({ ...metadata, location: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-[#0A1E60] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* KHỐI 2: CHỨC DANH HIỆU TRƯỞNG & THƯ KÝ */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-[#0A1E60] uppercase border-b border-slate-200 pb-1 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                2. Chức danh Hiệu trưởng (Chủ trì) và Thư ký cuộc họp
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chủ trì */}
                <div className="bg-blue-50/60 p-4 rounded-lg border border-blue-200 space-y-3">
                  <div className="font-bold text-xs text-[#0A1E60] uppercase flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-700" />
                    Chủ trì cuộc họp (Hiệu trưởng / Lãnh đạo Trường)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Họ và tên:</label>
                      <input
                        type="text"
                        value={metadata.chair_name}
                        onChange={(e) =>
                          setMetadata({
                            ...metadata,
                            chair_name: e.target.value,
                            chair: `${e.target.value} - ${metadata.chair_title}`,
                          })
                        }
                        className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0A1E60]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Chức danh / Chức vụ:</label>
                      <input
                        type="text"
                        value={metadata.chair_title}
                        onChange={(e) =>
                          setMetadata({
                            ...metadata,
                            chair_title: e.target.value,
                            chair: `${metadata.chair_name} - ${e.target.value}`,
                          })
                        }
                        className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0A1E60]"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Đơn vị công tác:</label>
                      <input
                        type="text"
                        value={metadata.chair_unit}
                        onChange={(e) => setMetadata({ ...metadata, chair_unit: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0A1E60]"
                      />
                    </div>
                  </div>
                </div>

                {/* Thư ký */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                  <div className="font-bold text-xs text-slate-800 uppercase flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-600" />
                    Thư ký cuộc họp
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Họ và tên:</label>
                      <input
                        type="text"
                        value={metadata.secretary_name}
                        onChange={(e) =>
                          setMetadata({
                            ...metadata,
                            secretary_name: e.target.value,
                            secretary: `${e.target.value} - ${metadata.secretary_title}`,
                          })
                        }
                        className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0A1E60]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Chức danh / Chức vụ:</label>
                      <input
                        type="text"
                        value={metadata.secretary_title}
                        onChange={(e) =>
                          setMetadata({
                            ...metadata,
                            secretary_title: e.target.value,
                            secretary: `${metadata.secretary_name} - ${e.target.value}`,
                          })
                        }
                        className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0A1E60]"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Đơn vị công tác:</label>
                      <input
                        type="text"
                        value={metadata.secretary_unit}
                        onChange={(e) => setMetadata({ ...metadata, secretary_unit: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0A1E60]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* KHỐI 3: BOX NHẬP SỐ LƯỢNG ĐẠI BIỂU THAM DỰ */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-[#0A1E60] uppercase border-b border-slate-200 pb-1 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                3. Số lượng đại biểu tham dự
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 bg-blue-50/60 p-3.5 rounded-lg border border-blue-200">
                  <label className="text-xs font-bold text-slate-800 uppercase flex items-center justify-between">
                    <span>Tổng số triệu tập:</span>
                    <span className="text-[10px] font-bold text-[#0A1E60] bg-blue-100 px-2 py-0.5 rounded">Đại biểu</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={metadata.total_invited}
                    onChange={(e) => setMetadata({ ...metadata, total_invited: parseInt(e.target.value) || 0 })}
                    placeholder="Nhập số đại biểu triệu tập"
                    className="w-full px-3 py-2 text-base bg-white border border-slate-300 rounded font-bold text-slate-900 focus:ring-2 focus:ring-[#0A1E60] focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500">Tổng số đại biểu được triệu tập / mời họp</p>
                </div>

                <div className="space-y-1.5 bg-emerald-50/60 p-3.5 rounded-lg border border-emerald-200">
                  <label className="text-xs font-bold text-slate-800 uppercase flex items-center justify-between">
                    <span>Số đại biểu có mặt:</span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">Có mặt</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={metadata.total_present}
                    onChange={(e) => setMetadata({ ...metadata, total_present: parseInt(e.target.value) || 0 })}
                    placeholder="Nhập số đại biểu có mặt"
                    className="w-full px-3 py-2 text-base bg-white border border-slate-300 rounded font-bold text-emerald-700 focus:ring-2 focus:ring-[#0A1E60] focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500">Số lượng đại biểu thực tế có mặt dự</p>
                </div>

                <div className="space-y-1.5 bg-amber-50/60 p-3.5 rounded-lg border border-amber-200">
                  <label className="text-xs font-bold text-slate-800 uppercase flex items-center justify-between">
                    <span>Số đại biểu vắng mặt:</span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">Vắng mặt</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={metadata.total_absent}
                    onChange={(e) => setMetadata({ ...metadata, total_absent: parseInt(e.target.value) || 0 })}
                    placeholder="Nhập số đại biểu vắng mặt"
                    className="w-full px-3 py-2 text-base bg-white border border-slate-300 rounded font-bold text-amber-700 focus:ring-2 focus:ring-[#0A1E60] focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500">Số lượng đại biểu vắng mặt</p>
                </div>
              </div>

              {/* Chi tiết lý do vắng mặt */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-slate-700 uppercase">Ghi chú đại biểu vắng mặt (họ tên và lý do nếu có):</label>
                <input
                  type="text"
                  value={metadata.absentees_detail}
                  onChange={(e) => setMetadata({ ...metadata, absentees_detail: e.target.value })}
                  placeholder="Ví dụ: Không có (Có mặt đầy đủ) hoặc 01 đồng chí (TS. Nguyễn Văn A - Đi công tác)"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-1 focus:ring-[#0A1E60] focus:outline-none"
                />
              </div>
            </div>

            {/* KHỐI 4: DANH SÁCH ĐẠI BIỂU DỰ */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-1">
                <h4 className="font-bold text-sm text-[#0A1E60] uppercase flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  4. Danh sách đại biểu dự (Họ tên, Chức danh, Đơn vị)
                </h4>
                {attendeeList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const presentCount = attendeeList.filter((a) => a.present).length;
                      const absentCount = attendeeList.filter((a) => !a.present).length;
                      setMetadata({
                        ...metadata,
                        total_invited: attendeeList.length,
                        total_present: presentCount,
                        total_absent: absentCount,
                      });
                    }}
                    className="text-xs text-[#0A1E60] hover:underline font-semibold cursor-pointer"
                  >
                    Cập nhật số lượng theo bảng ({attendeeList.length} đại biểu)
                  </button>
                )}
              </div>

              {/* Form thêm đại biểu nhanh */}
              <form onSubmit={handleAddAttendee} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-wrap gap-2.5 items-end">
                <div className="flex-1 min-w-[200px] space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Họ và tên đại biểu:</label>
                  <input
                    type="text"
                    value={newAttendee.name}
                    onChange={(e) => setNewAttendee({ ...newAttendee, name: e.target.value })}
                    placeholder="Ví dụ: TS. Nguyễn Văn A"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0A1E60]"
                  />
                </div>

                <div className="w-44 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Chức danh / Chức vụ:</label>
                  <input
                    type="text"
                    value={newAttendee.role}
                    onChange={(e) => setNewAttendee({ ...newAttendee, role: e.target.value })}
                    placeholder="Trưởng phòng / Trưởng khoa"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0A1E60]"
                  />
                </div>

                <div className="w-48 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Đơn vị công tác:</label>
                  <input
                    type="text"
                    value={newAttendee.department}
                    onChange={(e) => setNewAttendee({ ...newAttendee, department: e.target.value })}
                    placeholder="Khoa / Phòng chức năng"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0A1E60]"
                  />
                </div>

                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#0A1E60] hover:bg-blue-900 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer h-[30px]"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm đại biểu
                </button>
              </form>

              {/* Bảng danh sách đại biểu dự */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-12 text-center">STT</th>
                      <th className="p-2.5">Họ và tên</th>
                      <th className="p-2.5">Chức vụ / Chức danh</th>
                      <th className="p-2.5">Đơn vị</th>
                      <th className="p-2.5 w-24 text-center">Trạng thái</th>
                      <th className="p-2.5 w-12 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {attendeeList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                          Chưa có đại biểu nào trong danh sách. Bạn có thể nhập họ tên, chức danh và bấm "Thêm đại biểu" ở trên, hoặc chỉ cần nhập số lượng đại biểu tại Mục 3.
                        </td>
                      </tr>
                    ) : (
                      attendeeList.map((att, idx) => (
                        <tr key={att.id} className="hover:bg-slate-50 transition">
                          <td className="p-2.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900">{att.name}</td>
                          <td className="p-2.5 text-slate-700">{att.role}</td>
                          <td className="p-2.5 text-slate-700">{att.department}</td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(att.id)}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                                att.present
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}
                            >
                              {att.present ? 'Có mặt' : 'Vắng'}
                            </button>
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveAttendee(att.id)}
                              className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                              title="Xóa đại biểu"
                            >
                              <Trash2 className="w-3.5 h-3.5 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Tóm tắt danh sách đại biểu dự */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-slate-700 uppercase">Tóm tắt danh sách đại biểu dự ghi trong biên bản:</label>
                <textarea
                  rows={2}
                  value={metadata.attendees_summary}
                  onChange={(e) => setMetadata({ ...metadata, attendees_summary: e.target.value })}
                  placeholder="Ví dụ: Các đồng chí trong Ban Giám hiệu; Trưởng các Phòng chức năng, Khoa đào tạo và Trung tâm..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#0A1E60] focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BIÊN BẢN HỌP (Yêu cầu 3: Đổi tên thành "Biên bản họp"; Yêu cầu 4: Bỏ dữ liệu mẫu ban đầu) */}
        {activeTab === 'document' && (
          <div className="space-y-6">
            {!minutes ? (
              // Trạng thái khi chưa có nội dung ghi âm / phân tích
              <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-10 text-center space-y-4 max-w-2xl mx-auto my-8">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-[#0A1E60] flex items-center justify-center mx-auto border border-blue-200 shadow-sm">
                  <FileText className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-lg text-[#0A1E60]">Chưa có nội dung biên bản cuộc họp</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Vui lòng thực hiện quy trình tại <strong>Tab 1</strong>: mở website AI, cung cấp nguồn và nhập JSON kết quả. Bạn cũng có thể tạo cấu trúc JSON trống để tự nhập nội dung.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('pipeline')}
                    className="px-5 py-2.5 bg-[#0A1E60] hover:bg-blue-900 text-white rounded text-xs font-bold shadow flex items-center gap-2 cursor-pointer"
                  >
                    <Mic className="w-4 h-4" />
                    Chuyển đến Tab 1 để Ghi âm ngay
                  </button>

                  <button
                    onClick={handleCreateEmptyMinutes}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    Tạo JSON biên bản trống
                  </button>
                </div>
              </div>
            ) : (
              // Trạng thái khi đã có biên bản thực tế được AI soạn thảo
              <>
                {/* PDF Toolbar */}
                <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-slate-800 text-white p-3 rounded-t-lg shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow">
                      PDF A4
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                      Bien_ban_hop_NUTE.pdf
                    </span>
                    <span className="hidden md:inline-block text-slate-400 text-xs">
                      • Lề: Trái 30mm, Phải 15mm, Trên 20mm, Dưới 20mm • Times New Roman • Chuẩn NĐ 30/2020/NĐ-CP
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyDocumentText}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedText ? 'Đã sao chép!' : 'Sao chép'}
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow"
                      title="Mở hộp thoại in để lưu trực tiếp dạng PDF khổ A4"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      In / Xuất PDF
                    </button>
                    <button
                      onClick={handleDownloadWord}
                      disabled={isExportingWord}
                      className="px-3.5 py-1.5 bg-[#FEE000] hover:bg-yellow-400 text-[#0A1E60] font-bold rounded text-xs flex items-center gap-1.5 transition cursor-pointer shadow disabled:opacity-50"
                    >
                      {isExportingWord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      Tải file Word (.docx)
                    </button>
                  </div>
                </div>

                {/* VÙNG HIỂN THỊ DẠNG PDF KHỔ A4 (CHUẨN NGHỊ ĐỊNH 30/2020/NĐ-CP) */}
                <div className="bg-[#525659] p-3 sm:p-8 rounded-b-lg overflow-x-auto flex justify-center shadow-inner">
                  <div
                    className="print-page-a4 bg-white text-black shadow-2xl mx-auto"
                    style={{
                      width: '210mm',
                      minHeight: '297mm',
                      maxWidth: '100%',
                      paddingTop: '20mm',
                      paddingBottom: '20mm',
                      paddingLeft: '30mm',
                      paddingRight: '15mm',
                      fontFamily: "'Times New Roman', Times, 'Liberation Serif', serif",
                      lineHeight: '1.35',
                      boxSizing: 'border-box',
                      color: '#000000',
                    }}
                  >
                    {/* 1. HEADER NGHỊ ĐỊNH 30: BẢNG 2 CỘT */}
                    <div className="grid grid-cols-2 gap-2 text-center pb-4">
                      {/* Cột trái: Cơ quan chủ quản & Cơ quan ban hành */}
                      <div className="flex flex-col items-center">
                        <div style={{ fontSize: '12pt' }} className="uppercase">
                          {metadata.superior_agency || 'BỘ GIÁO DỤC VÀ ĐÀO TẠO'}
                        </div>
                        <div style={{ fontSize: '12pt' }} className="font-bold uppercase">
                          {metadata.agency_name || 'TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT NAM ĐỊNH'}
                        </div>
                        <div className="w-28 h-[1px] bg-black my-1"></div>
                        <div style={{ fontSize: '13pt' }}>
                          {metadata.document_code || 'Số: .../BB-ĐHSPKTNĐ'}
                        </div>
                      </div>

                      {/* Cột phải: Quốc hiệu, Tiêu ngữ, Địa danh ngày tháng */}
                      <div className="flex flex-col items-center">
                        <div style={{ fontSize: '12pt' }} className="font-bold uppercase">
                          CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                        </div>
                        <div style={{ fontSize: '13.5pt' }} className="font-bold">
                          Độc lập - Tự do - Hạnh phúc
                        </div>
                        <div className="w-40 h-[1.5px] bg-black my-1"></div>
                        <div style={{ fontSize: '13pt' }} className="italic">
                          {metadata.location_date || 'Chưa khai báo ngày họp'}
                        </div>
                      </div>
                    </div>

                    {/* 2. TÊN LOẠI VĂN BẢN VÀ TRÍCH YẾU */}
                    <div className="text-center my-6 space-y-1">
                      <div style={{ fontSize: '15pt' }} className="font-bold tracking-wide uppercase">
                        BIÊN BẢN
                      </div>
                      <div style={{ fontSize: '14pt' }} className="font-bold uppercase">
                        {metadata.meeting_title}
                      </div>
                    </div>

                    {/* 3. PHẦN I: THỜI GIAN, ĐỊA ĐIỂM */}
                    <div className="space-y-1 mt-5">
                      <div style={{ fontSize: '13.5pt' }} className="font-bold uppercase">
                        I. THỜI GIAN, ĐỊA ĐIỂM
                      </div>
                      <div style={{ fontSize: '13pt' }} className="pl-6 space-y-1">
                        <p>
                          <strong className="font-bold">- Thời gian:</strong> Bắt đầu từ {metadata.start_time || 'Chưa khai báo'}, kết thúc hồi {metadata.end_time || 'Chưa khai báo'}.
                        </p>
                        <p>
                          <strong className="font-bold">- Địa điểm:</strong> {metadata.location || 'Chưa khai báo'}
                        </p>
                      </div>
                    </div>

                    {/* 4. PHẦN II: THÀNH PHẦN THAM DỰ */}
                    <div className="space-y-1 mt-5">
                      <div style={{ fontSize: '13.5pt' }} className="font-bold uppercase">
                        II. THÀNH PHẦN THAM DỰ
                      </div>
                      <div style={{ fontSize: '13pt' }} className="pl-6 space-y-1.5">
                        <p>
                          <strong className="font-bold">1. Chủ trì cuộc họp:</strong> {metadata.chair_name} - {metadata.chair_title} ({metadata.chair_unit}).
                        </p>
                        <p>
                          <strong className="font-bold">2. Thư ký cuộc họp:</strong> {metadata.secretary_name} - {metadata.secretary_title} ({metadata.secretary_unit}).
                        </p>
                        <p>
                          <strong className="font-bold">3. Số lượng đại biểu tham dự:</strong> Tổng số triệu tập: <strong>{metadata.total_invited}</strong> đồng chí; Có mặt: <strong>{metadata.total_present}</strong> đồng chí; Vắng mặt: <strong>{metadata.total_absent}</strong> đồng chí.
                        </p>
                        <p>
                          <strong className="font-bold">4. Danh sách đại biểu dự:</strong> {metadata.attendees_summary || '(Theo danh sách triệu tập và điểm danh cuộc họp).'}
                        </p>
                        <p>
                          <strong className="font-bold">5. Đại biểu vắng mặt:</strong> {metadata.absentees_detail}
                        </p>
                      </div>
                    </div>

                    {/* 5. PHẦN III: NỘI DUNG VÀ DIỄN BIẾN CUỘC HỌP */}
                    <div className="space-y-2 mt-5">
                      <div style={{ fontSize: '13.5pt' }} className="font-bold uppercase">
                        III. NỘI DUNG VÀ DIỄN BIẾN CUỘC HỌP
                      </div>
                      <div style={{ fontSize: '13pt' }} className="pl-6 space-y-2.5">
                        <div>
                          <strong className="font-bold">1. Quán triệt của Chủ trì cuộc họp:</strong>
                          <p style={{ textIndent: '1.2cm' }} className="mt-1 text-justify">
                            {minutes.opening_statement}
                          </p>
                        </div>

                        <div>
                          <strong className="font-bold">2. Ý kiến phát biểu và thảo luận của các thành viên dự họp:</strong>
                          <div className="mt-1 space-y-1.5">
                            {minutes.discussions && minutes.discussions.length > 0 ? (
                              minutes.discussions.map((d, idx) => (
                                <p key={idx} className="text-justify">
                                  - <strong className="font-bold">Ý kiến {idx + 1} ({d.speaker}{d.role ? ` - ${d.role}` : ''}):</strong> {d.content}
                                </p>
                              ))
                            ) : (
                              <p className="italic text-slate-600">Chưa có dữ liệu ý kiến thảo luận.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 6. PHẦN IV: KẾT LUẬN CỦA CHỦ TRÌ CUỘC HỌP */}
                    <div className="space-y-2 mt-5">
                      <div style={{ fontSize: '13.5pt' }} className="font-bold uppercase">
                        IV. KẾT LUẬN CỦA CHỦ TRÌ CUỘC HỌP
                      </div>
                      <div style={{ fontSize: '13pt' }} className="pl-6 space-y-2.5 text-justify">
                        <p style={{ textIndent: '1.2cm' }}>
                          Nội dung kết luận được ghi nhận từ nguồn cuộc họp:
                        </p>
                        <ul className="list-decimal pl-6 space-y-1.5">
                          {minutes.conclusions && minutes.conclusions.length > 0 ? (
                            minutes.conclusions.map((c, idx) => (
                              <li key={idx} className="pl-1">
                                {c}
                              </li>
                            ))
                          ) : (
                            <li>Chưa có dữ liệu kết luận của chủ trì.</li>
                          )}
                        </ul>

                        {/* BẢNG PHÂN CÔNG NHIỆM VỤ */}
                        <div className="mt-3">
                          <p className="font-bold mb-1.5">Bảng phân công trách nhiệm và tiến độ thực hiện:</p>
                          <table style={{ fontSize: '12.5pt', borderCollapse: 'collapse', border: '1px solid black' }} className="w-full text-left">
                            <thead>
                              <tr className="bg-slate-100">
                                <th style={{ border: '1px solid black', width: '40px' }} className="p-1.5 text-center font-bold">STT</th>
                                <th style={{ border: '1px solid black' }} className="p-1.5 text-left font-bold">Nội dung nhiệm vụ / Sản phẩm đầu ra</th>
                                <th style={{ border: '1px solid black', width: '28%' }} className="p-1.5 text-left font-bold">Đơn vị / Người thực hiện</th>
                                <th style={{ border: '1px solid black', width: '22%' }} className="p-1.5 text-center font-bold">Thời hạn hoàn thành</th>
                              </tr>
                            </thead>
                            <tbody>
                              {minutes.tasks && minutes.tasks.length > 0 ? (
                                minutes.tasks.map((task, i) => (
                                  <tr key={i}>
                                    <td style={{ border: '1px solid black' }} className="p-1.5 text-center">{i + 1}</td>
                                    <td style={{ border: '1px solid black' }} className="p-1.5">
                                      <div className="font-bold">{task.task_name}</div>
                                      {task.requirements && <div style={{ fontSize: '11pt' }} className="text-slate-600">Yêu cầu: {task.requirements}</div>}
                                    </td>
                                    <td style={{ border: '1px solid black' }} className="p-1.5">{task.assigned_unit}</td>
                                    <td style={{ border: '1px solid black' }} className="p-1.5 text-center">{task.deadline}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={4} style={{ border: '1px solid black' }} className="p-2 text-center italic text-slate-500">
                                    Chưa có bảng phân công nhiệm vụ cụ thể.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* 7. PHẦN KẾT THÚC BIÊN BẢN */}
                    <div style={{ fontSize: '13pt', textIndent: '1.2cm' }} className="mt-5 italic text-justify">
                      <p>{minutes.closing_statement}</p>
                    </div>

                    {/* 8. CHỮ KÝ 2 BÊN THEO NGHỊ ĐỊNH 30 */}
                    <div className="grid grid-cols-2 gap-4 mt-8 pt-2 text-center">
                      <div>
                        <div style={{ fontSize: '13pt' }} className="font-bold uppercase">THƯ KÝ CUỘC HỌP</div>
                        <div style={{ fontSize: '12pt' }} className="italic">(Ký và ghi rõ họ tên)</div>
                        <div className="h-24"></div>
                        <div style={{ fontSize: '13.5pt' }} className="font-bold">{metadata.secretary_name}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '13pt' }} className="font-bold uppercase">{metadata.chair_title || 'CHỦ TRÌ CUỘC HỌP'}</div>
                        <div style={{ fontSize: '12pt' }} className="italic">(Ký và ghi rõ họ tên)</div>
                        <div className="h-24"></div>
                        <div style={{ fontSize: '13.5pt' }} className="font-bold">{metadata.chair_name}</div>
                      </div>
                    </div>

                    {/* 9. NƠI NHẬN */}
                    <div style={{ fontSize: '11pt' }} className="mt-6 pt-2 border-t border-slate-300">
                      <p className="font-bold italic">Nơi nhận:</p>
                      <p>- Ban Giám hiệu (để báo cáo);</p>
                      <p>- Các đơn vị trực thuộc Trường (để thực hiện);</p>
                      <p>- Lưu: VT, Hồ sơ cuộc họp.</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: XUẤT BẢN WORD (.DOCX) */}
        {activeTab === 'export' && (
          <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-[#0A1E60] flex items-center gap-2">
                  <Download className="w-5 h-5 text-blue-600" />
                  Xuất bản Biên bản cuộc họp sang Microsoft Word (.docx)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Định dạng chuẩn theo Nghị định 30/2020/NĐ-CP cho Trường Đại học Sư phạm Kỹ thuật Nam Định.
                </p>
              </div>
              <NuteLogo className="w-10 h-10" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-[#0A1E60] text-white flex items-center justify-center font-bold">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-[#0A1E60]">Tải file Microsoft Word (.docx)</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tải về tệp <code>.docx</code> nguyên bản có thể mở và chỉnh sửa trực tiếp trên Microsoft Word, LibreOffice hoặc Google Docs.
                  </p>
                </div>
                <button
                  onClick={handleDownloadWord}
                  disabled={isExportingWord || !minutes}
                  className="w-full py-2.5 bg-[#0A1E60] hover:bg-blue-900 text-white font-bold rounded text-xs flex items-center justify-center gap-2 shadow cursor-pointer disabled:opacity-50"
                >
                  {isExportingWord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-yellow-300" />}
                  Tải ngay file .docx
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold">
                    <Copy className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">Sao chép nội dung văn bản</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Sao chép toàn bộ nội dung biên bản vào Clipboard để nhanh chóng dán vào email hoặc hệ thống Quản lý văn bản điện tử (e-Office).
                  </p>
                </div>
                <button
                  onClick={handleCopyDocumentText}
                  disabled={!minutes}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded text-xs flex items-center justify-center gap-2 shadow cursor-pointer disabled:opacity-50"
                >
                  {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copiedText ? 'Đã sao chép vào Clipboard!' : 'Sao chép văn bản'}
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold">
                    <Printer className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">In trực tiếp bản A4</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Mở hộp thoại in ấn của trình duyệt để in trực tiếp ra máy in hoặc lưu dưới dạng tệp PDF chuẩn trang in A4.
                  </p>
                </div>
                <button
                  onClick={() => window.print()}
                  disabled={!minutes}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs flex items-center justify-center gap-2 shadow cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  In biên bản (Ctrl+P)
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 text-xs text-slate-600">
              <span className="font-bold text-slate-800 uppercase">Quy cách định dạng tệp Word xuất ra:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-slate-400">Khổ giấy</div>
                  <div className="font-bold text-slate-800">A4 tiêu chuẩn</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-slate-400">Định lề trang</div>
                  <div className="font-bold text-slate-800">30 - 20 - 20 - 15 mm</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-slate-400">Phông chữ</div>
                  <div className="font-bold text-slate-800">Times New Roman</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-slate-400">Dãn dòng</div>
                  <div className="font-bold text-slate-800">1.15 lines (chuẩn NĐ 30)</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER TRƯỜNG ĐH SPKT NAM ĐỊNH */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-600">
        <div className="flex items-center justify-center gap-2">
          <NuteLogo className="w-4 h-4" />
          <span>TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT NAM ĐỊNH • Đường Phù Nghĩa, Phường Hạ Long, TP. Nam Định</span>
        </div>
      </footer>
    </div>
  );
}
