import type { AdministrativeMinutes, DiscussionOpinion } from '../types';
type ReviewMinutes = AdministrativeMinutes & { _review?: { signature: string; at: string }; _originalDiscussions?: DiscussionOpinion[] };
export function signature(m: AdministrativeMinutes): string {
  const { document_code: _code, ...metadata } = m.metadata;
  return JSON.stringify({ metadata, opening_statement:m.opening_statement, discussions:m.discussions,
    conclusions:m.conclusions,tasks:m.tasks,closing_statement:m.closing_statement });
}
export function isReviewed(m: AdministrativeMinutes | null): boolean {
  return !!m && (m as ReviewMinutes)._review?.signature === signature(m);
}
export function approveMinutes(m: AdministrativeMinutes): AdministrativeMinutes {
  return { ...m, _review:{signature:signature(m),at:new Date().toISOString()} } as ReviewMinutes;
}
export function compactUnknown(m: AdministrativeMinutes, limit=12): AdministrativeMinutes {
  const unknown=(d: DiscussionOpinion)=> !d.speaker.trim() || /chưa xác định|không xác định|nội dung tổng hợp|^người nói\s*\d*$|^đại biểu$/i.test(d.speaker.trim());
  const count=m.discussions.filter(unknown).length;
  if(count<=limit) return m;
  const size=Math.ceil(count/limit); let pending:DiscussionOpinion[]=[];
  const discussions:DiscussionOpinion[]=[];
  const flush=()=> { if(!pending.length)return; discussions.push({speaker:'Nội dung tổng hợp — chưa xác định người phát biểu',role:'',
    timestamp:pending[0].timestamp || '',content:pending.map(d=>`${d.timestamp ? '['+d.timestamp+'] ' : ''}${d.content}`).join('\n\n')});pending=[]; };
  for(const d of m.discussions){ if(unknown(d)){pending.push(d);if(pending.length>=size)flush();}else{flush();discussions.push({...d});} } flush();
  return {...m,discussions,_originalDiscussions:(m as ReviewMinutes)._originalDiscussions || m.discussions} as ReviewMinutes;
}
export function restoreDiscussions(m: AdministrativeMinutes): AdministrativeMinutes {
  return {...m,discussions:(m as ReviewMinutes)._originalDiscussions || m.discussions};
}
export function mergeSelected(m: AdministrativeMinutes, indices:number[], speaker:string, role:string): AdministrativeMinutes {
  const selected=new Set(indices);const source=m.discussions.filter((_,i)=>selected.has(i));
  if(!source.length)return m;
  const merged={speaker:speaker.trim() || 'Nội dung tổng hợp — chưa xác định người phát biểu',role:role.trim(),
    timestamp:source[0].timestamp || '',content:source.map(d=>`${d.timestamp ? '['+d.timestamp+'] ' : ''}${d.content}`).join('\n\n')};
  const first=Math.min(...indices);
  return {...m,discussions:m.discussions.flatMap((d,i)=>i===first?[merged]:selected.has(i)?[]:[d])};
}
