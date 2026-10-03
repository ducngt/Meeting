import type { AdministrativeMinutes, MeetingMetadata, TranscriptSegment } from '../types';

export interface SavedMeeting {
  id: string;
  createdAt: string;
  updatedAt: string;
  recordingStartedAt?: string;
  recordingEndedAt?: string;
  metadata: MeetingMetadata;
  minutes: AdministrativeMinutes | null;
  segments: TranscriptSegment[];
  audioBlob: Blob | null;
  audioFileName: string;
  duration: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('nute-meetings', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('meetings', { keyPath: 'id' });
      request.result.createObjectStore('counters');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Hãy đóng các tab Meeting khác rồi thử lại.'));
  });
}

export async function listMeetings(): Promise<SavedMeeting[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meetings', 'readonly');
    const request = tx.objectStore('meetings').getAll();
    tx.oncomplete = () => {
      db.close();
      resolve((request.result as SavedMeeting[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function saveMeeting(record: SavedMeeting): Promise<SavedMeeting> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    // Record and counter are committed together, including across browser tabs.
    const tx = db.transaction(['meetings', 'counters'], 'readwrite');
    const meetings = tx.objectStore('meetings');
    const counters = tx.objectStore('counters');
    const previous = meetings.get(record.id);
    let saved: SavedMeeting | undefined;
    previous.onsuccess = () => {
      const old = previous.result as SavedMeeting | undefined;
      const metadata = { ...record.metadata, superior_agency: 'BỘ GIÁO DỤC VÀ ĐÀO TẠO', agency_name: 'TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT NAM ĐỊNH' };
      const finish = () => {
        saved = { ...record, createdAt: old?.createdAt || record.createdAt,
          updatedAt: new Date().toISOString(), metadata,
          minutes: record.minutes ? { ...record.minutes, metadata } : null };
        meetings.put(saved);
      };
      if (old?.minutes?.metadata.document_code) {
        metadata.document_code = old.minutes.metadata.document_code;
        finish();
      } else if (record.minutes) {
        const declaredYear = !record.recordingStartedAt ? record.metadata.location_date?.match(/năm\s+(\d{4})/)?.[1] : undefined;
        const year = declaredYear || new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' })
          .format(new Date(record.recordingStartedAt || record.createdAt));
        const sequence = counters.get(year);
        sequence.onsuccess = () => {
          const next = Number(sequence.result || 0) + 1;
          counters.put(next, year);
          metadata.document_code = `${String(next).padStart(2, '0')}/${year}/BB-ĐHSPKTNĐ`;
          finish();
        };
      } else {
        metadata.document_code = '';
        finish();
      }
    };
    tx.oncomplete = () => { db.close(); if (saved) resolve(saved); else reject(new Error('Không lưu được cuộc họp.')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Không lưu được cuộc họp.')); };
  });
}

export async function deleteMeeting(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meetings', 'readwrite');
    tx.objectStore('meetings').delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export function recordingDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `Ninh Bình, ngày ${value('day')} tháng ${value('month')} năm ${value('year')}`;
}

export function recordingTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${value('hour')} giờ ${value('minute')} phút ${value('second')} giây ngày ${value('day')}/${value('month')}/${value('year')}`;
}
