import { MeetingMetadata, AttendeeItem } from './types';

const now = new Date();
const day = String(now.getDate()).padStart(2, '0');
const month = String(now.getMonth() + 1).padStart(2, '0');
const year = now.getFullYear();

// Dữ liệu danh sách đại biểu ban đầu để trống theo yêu cầu của người dùng
export const DEFAULT_ATTENDEES: AttendeeItem[] = [];

export const DEFAULT_METADATA: MeetingMetadata = {
  superior_agency: 'BỘ GIÁO DỤC VÀ ĐÀO TẠO',
  agency_name: 'TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT NAM ĐỊNH',
  document_code: `Số: ${day}/BB-ĐHSPKTNĐ`,
  location: 'Phòng họp Ban Giám hiệu, Tầng 2 - Nhà Hiệu bộ, Trường ĐH SPKT Nam Định',
  location_date: `Nam Định, ngày ${day} tháng ${month} năm ${year}`,
  meeting_title: 'Cuộc họp Ban Giám hiệu về công tác trọng tâm',
  start_time: '08 giờ 30 phút',
  end_time: '11 giờ 30 phút cùng ngày',
  chair_name: 'TS. Đặng Nguyên Hà',
  chair_title: 'Hiệu trưởng',
  chair_unit: 'Ban Giám hiệu',
  secretary_name: 'ThS. Trần Văn Nam',
  secretary_title: 'Phó Chánh Văn phòng',
  secretary_unit: 'Văn phòng Trường',
  total_invited: 0,
  total_present: 0,
  total_absent: 0,
  attendees_summary: '',
  absentees_detail: '',
  attendee_list: [],
  meeting_id: `BB-${year}-${month}-${day}`,
  chair: 'TS. Đặng Nguyên Hà - Hiệu trưởng',
  secretary: 'ThS. Trần Văn Nam - Phó Chánh Văn phòng',
  attendees: '',
  absentees: '',
};
