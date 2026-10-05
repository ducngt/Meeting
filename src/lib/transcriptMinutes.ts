import type { AdministrativeMinutes, MeetingMetadata, TranscriptSegment } from '../types';
import { requestGeminiJSON } from './geminiClient';
import { digestText, loadProgress, saveProgress } from './aiProgress';
export function hasMinutesContent(minutes: any): boolean {
  return !!(minutes && ((typeof minutes.opening_statement==='string' && minutes.opening_statement.trim()) ||
    (Array.isArray(minutes.discussions) && minutes.discussions.some((d: any)=>typeof d?.content==='string' && d.content.trim())) ||
    (Array.isArray(minutes.conclusions) && minutes.conclusions.some((c: any)=>typeof c==='string' && c.trim())) ||
    (Array.isArray(minutes.tasks) && minutes.tasks.some((t: any)=>typeof t?.task_name==='string' && t.task_name.trim()))));
}
export function transcriptBatches(segments: TranscriptSegment[], limit=7000): string[] {
  const batches: string[]=[]; let current='';
  for (const segment of segments) {
    const prefix=`[${segment.start_fmt || ''}] ${segment.speaker || 'Người phát biểu chưa xác định'}: `;
    const capacity=Math.max(100, limit-prefix.length-1);
    for (let offset=0; offset<segment.text.length; offset+=capacity) {
      const line=prefix+segment.text.slice(offset,offset+capacity)+'\n';
      if (current && current.length+line.length>limit) { batches.push(current);current=''; }
      current+=line;
    }
  }
  if (current.trim()) batches.push(current);
  return batches;
}
export function combineMinutes(items: AdministrativeMinutes[], metadata: MeetingMetadata): AdministrativeMinutes {
  const discussions=items.flatMap(item=>item.discussions);
  const conclusions=[...new Set(items.flatMap(item=>item.conclusions).filter(c=>c.trim()))];
  const tasks=items.flatMap(item=>item.tasks).filter((task,index,all)=>all.findIndex(other=>
    other.task_name===task.task_name && other.assigned_unit===task.assigned_unit && other.deadline===task.deadline)===index)
    .map((task,index)=>({...task,code:`NV-${String(index+1).padStart(2,'0')}`}));
  return {metadata,opening_statement:items.find(item=>item.opening_statement.trim())?.opening_statement || '',
    discussions,conclusions,tasks,closing_statement:[...items].reverse().find(item=>item.closing_statement.trim())?.closing_statement || ''};
}
export async function minutesFromTranscript(segments: TranscriptSegment[], metadata: MeetingMetadata,
  onStatus: (message: string)=>void): Promise<AdministrativeMinutes> {
  const batches=transcriptBatches(segments.filter(segment=>segment.text?.trim()));
  if (!batches.length) throw new Error('Chưa có lời thoại để soạn biên bản.');
  const results: AdministrativeMinutes[]=[];
  for (let index=0;index<batches.length;index++) {
    const text=`Thông tin khai báo:\n${JSON.stringify(metadata)}\nNhóm lời thoại ${index+1}/${batches.length}:\n${batches[index]}`;
    const key='minutes-v2:'+await digestText(text);
    let result=await loadProgress<AdministrativeMinutes>(key);
    if (!result) {
      onStatus(`Đang tổng hợp biên bản, nhóm ${index+1}/${batches.length}…`);
      const data=await requestGeminiJSON({
        systemInstruction:{parts:[{text:`Soạn nội dung biên bản từ nhóm lời thoại nguồn, không bịa.
Chỉ trả JSON có opening_statement (chuỗi), discussions (mảng đối tượng speaker, role, content, timestamp đều là chuỗi), conclusions (mảng chuỗi), tasks (mảng đối tượng code, task_name, assigned_unit, deadline, requirements đều là chuỗi), closing_statement (chuỗi).
Nếu có lời thoại thì discussions phải có nội dung tóm tắt trung thực, kể cả khi là thuyết trình hay trao đổi không có quyết định. Tóm tắt theo từng ý, không chép nguyên văn toàn bộ.
Đây chỉ là một phần nguồn: chỉ ghi khai mạc/kết thúc nếu nguồn phần này xác nhận. Không tự coi ý kiến người nói là kết luận của chủ trì. Không suy ra tên người nói từ danh sách đại biểu; giữ nhãn chưa xác định. Không bịa nhiệm vụ, thời hạn hay việc thông qua biên bản. Mục chưa có dữ liệu để chuỗi rỗng hoặc []. Giữ mốc thời gian nguồn.`}]},
        contents:[{role:'user',parts:[{text}]}],generationConfig:{temperature:0.1,responseMimeType:'application/json'},
      },onStatus);
      const value=data.minutes || data;
      const strings=(item: any,fields: string[])=>item && fields.every(field=>typeof item[field]==='string');
      if (!strings(value,['opening_statement','closing_statement']) || !Array.isArray(value.discussions) ||
        !value.discussions.every((d: any)=>strings(d,['speaker','role','content','timestamp'])) ||
        !value.discussions.some((d: any)=>d.content.trim()) || !Array.isArray(value.conclusions) ||
        !value.conclusions.every((c: any)=>typeof c==='string') || !Array.isArray(value.tasks) ||
        !value.tasks.every((t: any)=>strings(t,['code','task_name','assigned_unit','deadline','requirements']))) {
        throw new Error(`AI chưa trả nội dung biên bản hợp lệ ở nhóm ${index+1}. Lời thoại và tiến độ được giữ.`);
      }
      result={...value,metadata} as AdministrativeMinutes;
      await saveProgress(key,result);
      await new Promise(resolve=>setTimeout(resolve,4000));
    }
    results.push(result);
  }
  return combineMinutes(results,metadata);
}
