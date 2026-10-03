import { MeetingMetadata, AttendeeItem } from './types';

// Dữ liệu danh sách đại biểu ban đầu để trống theo yêu cầu của người dùng
export const DEFAULT_ATTENDEES: AttendeeItem[] = [];

export const DEFAULT_METADATA: MeetingMetadata = {
  superior_agency: '',
  agency_name: '',
  document_code: '',
  location: '',
  location_date: '',
  meeting_title: '',
  start_time: '',
  end_time: '',
  chair_name: '',
  chair_title: '',
  chair_unit: '',
  secretary_name: '',
  secretary_title: '',
  secretary_unit: '',
  total_invited: 0,
  total_present: 0,
  total_absent: 0,
  attendees_summary: '',
  absentees_detail: '',
  attendee_list: [],
  meeting_id: '',
  chair: '',
  secretary: '',
  attendees: '',
  absentees: '',
};
