export interface AttendeeItem {
  id: string;
  name: string;
  role: string;
  department: string;
  present: boolean;
  absentReason?: string;
}

export interface MeetingMetadata {
  superior_agency: string; // Cơ quan chủ quản (vd: BỘ LAO ĐỘNG - THƯƠNG BINH VÀ XÃ HỘI)
  agency_name: string;     // Cơ quan ban hành (TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT NAM ĐỊNH)
  document_code: string;   // Số ký hiệu văn bản (vd: Số: 15/BB-ĐHSPKTNĐ)
  location: string;        // Địa điểm họp
  location_date: string;   // Địa danh, ngày tháng (vd: Nam Định, ngày 02 tháng 10 năm 2026)
  meeting_title: string;   // Tên cuộc họp / Trích yếu nội dung
  start_time: string;      // Giờ bắt đầu
  end_time: string;        // Giờ kết thúc
  
  // Thông tin Hiệu trưởng / Chủ trì
  chair_name: string;      // Họ và tên
  chair_title: string;     // Chức danh (Hiệu trưởng, Phó Hiệu trưởng)
  chair_unit: string;      // Đơn vị (Ban Giám hiệu)
  
  // Thông tin Thư ký
  secretary_name: string;  // Họ và tên Thư ký
  secretary_title: string; // Chức danh Thư ký
  secretary_unit: string;  // Đơn vị Thư ký
  
  // Số lượng & Thành phần tham dự
  total_invited: number;   // Tổng số triệu tập
  total_present: number;   // Có mặt
  total_absent: number;    // Vắng mặt
  attendees_summary: string; // Tóm tắt thành phần
  absentees_detail: string;  // Chi tiết vắng mặt
  attendee_list?: AttendeeItem[]; // Danh sách chi tiết từng đại biểu

  // Thuộc tính tương thích
  chair?: string;
  secretary?: string;
  attendees?: string;
  absentees?: string;
  meeting_id?: string;
  sources?: string[];
}

export interface TranscriptSegment {
  start: number;
  end: number;
  start_fmt: string;
  end_fmt: string;
  speaker: string;
  text: string;
}

export interface DiscussionOpinion {
  speaker: string;
  role?: string;
  content: string;
  timestamp?: string;
}

export interface AdministrativeTask {
  code: string;
  task_name: string;
  assigned_unit: string;
  deadline: string;
  requirements?: string;
}

export interface AdministrativeMinutes {
  metadata: MeetingMetadata;
  opening_statement: string; // Quán triệt của chủ trì cuộc họp
  discussions: DiscussionOpinion[]; // Ý kiến thảo luận của các thành viên
  conclusions: string[]; // Kết luận chỉ đạo của Hiệu trưởng / Chủ trì
  tasks: AdministrativeTask[]; // Bảng phân công nhiệm vụ
  closing_statement: string; // Biên bản kết thúc và thông qua
}
