import React, {useState, useEffect} from 'react';
import type {AdministrativeMinutes, AttendeeItem} from './types';
import {signature,isReviewed,compactUnknown,restoreDiscussions,mergeSelected} from './lib/minutesReview';
interface Props { minutes:AdministrativeMinutes; attendees:AttendeeItem[]; disabled:boolean;
  onChange:(m:AdministrativeMinutes)=>void; onApprove:(m:AdministrativeMinutes)=>Promise<void>; onSave:()=>Promise<void> }
const field='w-full border border-slate-300 rounded p-2 text-sm bg-white';
export default function MinutesEditor({minutes:m,attendees,disabled,onChange,onApprove,onSave}:Props){
  const [selected,setSelected]=useState<number[]>([]);const [name,setName]=useState('');const [role,setRole]=useState('');
  const [checked,setChecked]=useState(false);const [error,setError]=useState('');const reviewed=isReviewed(m);
  const contentSignature=signature(m);
  useEffect(()=>{setChecked(false);},[contentSignature]);
  const update=(next:AdministrativeMinutes)=>{setChecked(false);onChange(next);};
  const discussion=(i:number,key:string,value:string)=>update({...m,discussions:m.discussions.map((d,j)=>j===i?{...d,[key]:value}:d)});
  const action=(next:AdministrativeMinutes)=>{update(next);setSelected([]);};
  return <details className="no-print bg-white border border-blue-200 rounded p-4" open={!reviewed}>
    <summary className="font-bold text-[#0A1E60] cursor-pointer">{reviewed?'Đã xác nhận biên bản — mở để chỉnh sửa':'Thư ký hoàn thiện biên bản trước khi ban hành'}</summary>
    <fieldset disabled={disabled} className="space-y-4 mt-4 disabled:opacity-60">
      <p className="text-sm text-slate-600">Các mục dưới đây là nội dung, không phải số người nói. Kiểm tra với bản ghi âm, gán tên khi xác định được. Việc gom nội dung giữ nguyên lời thoại gốc.</p>
      <div className="flex flex-wrap gap-3 text-sm">
        <button type="button" onClick={()=>action(compactUnknown(m))} className="border rounded px-3 py-2">Gom các mục chưa xác định</button>
        <button type="button" onClick={()=>action(restoreDiscussions(m))} className="border rounded px-3 py-2">Khôi phục nội dung trước khi gom</button>
      </div>
      <label className="block">Nội dung khai mạc<textarea className={field} rows={3} value={m.opening_statement} onChange={e=>update({...m,opening_statement:e.target.value})}/></label>
      <h4 className="font-bold">Nội dung thảo luận ({m.discussions.length} mục)</h4>
      <div className="bg-blue-50 p-3 space-y-2 rounded">
        <p className="text-sm">Chọn các mục thuộc cùng người hoặc cùng nội dung để gán tên / gộp. Mục chưa rõ người nói giữ nhãn chưa xác định.</p>
        <input aria-label="Tên người phát biểu" list="review-attendees" className={field} value={name} placeholder="Tên người phát biểu đã đối chiếu" onChange={e=>{setName(e.target.value);setRole(attendees.find(a=>a.name===e.target.value)?.role || '');}}/>
        <datalist id="review-attendees">{attendees.map(a=><option key={a.id} value={a.name}/>)}</datalist>
        <input aria-label="Chức vụ" className={field} value={role} placeholder="Chức vụ" onChange={e=>setRole(e.target.value)}/>
        <button type="button" disabled={!selected.length || !name.trim()} onClick={()=>action({...m,discussions:m.discussions.map((d,i)=>selected.includes(i)?{...d,speaker:name.trim(),role}:d)})} className="border rounded p-2">Gán tên cho mục đã chọn</button>{' '}
        <button type="button" disabled={selected.length<2} onClick={()=>action(mergeSelected(m,selected,name,role))} className="border rounded p-2">Gộp các mục đã chọn ({selected.length})</button>
      </div>
      {m.discussions.map((d,i)=><div key={i} className="border rounded p-3 space-y-2">
        <label><input type="checkbox" checked={selected.includes(i)} onChange={e=>setSelected(e.target.checked?[...selected,i]:selected.filter(n=>n!==i))}/> Chọn nội dung {i+1}</label>
        <div className="grid md:grid-cols-3 gap-2">{(['speaker','role','timestamp'] as const).map(k=><input key={k} aria-label={k==='speaker'?'Người phát biểu':k==='role'?'Chức vụ':'Mốc thời gian'} className={field} value={d[k] || ''} onChange={e=>discussion(i,k,e.target.value)}/>)}</div>
        <textarea aria-label="Nội dung ý kiến" className={field} rows={4} value={d.content} onChange={e=>discussion(i,'content',e.target.value)}/>
        <button type="button" onClick={()=>action({...m,discussions:m.discussions.filter((_,j)=>j!==i)})} className="text-red-700 text-sm">Xóa mục này</button>
      </div>)}
      <button type="button" onClick={()=>action({...m,discussions:[...m.discussions,{speaker:'',role:'',timestamp:'',content:''}]})} className="border rounded p-2">Thêm nội dung / tách ý kiến</button>
      <label className="block">Kết luận (mỗi dòng một kết luận)<textarea className={field} rows={4} value={m.conclusions.join('\n')} onChange={e=>update({...m,conclusions:e.target.value.split('\n')})}/></label>
      <h4 className="font-bold">Phân công nhiệm vụ</h4>
      {m.tasks.map((t,i)=><div key={i} className="border rounded p-3 space-y-2">{(['task_name','assigned_unit','deadline','requirements'] as const).map(k=><label key={k} className="block text-sm">{{task_name:'Nhiệm vụ',assigned_unit:'Người / đơn vị thực hiện',deadline:'Thời hạn',requirements:'Yêu cầu'}[k]}<textarea className={field} rows={2} value={t[k] || ''} onChange={e=>update({...m,tasks:m.tasks.map((v,j)=>j===i?{...v,[k]:e.target.value}:v)})}/></label>)}<button type="button" className="text-red-700" onClick={()=>update({...m,tasks:m.tasks.filter((_,j)=>i!==j)})}>Xóa nhiệm vụ</button></div>)}
      <button type="button" className="border rounded p-2" onClick={()=>update({...m,tasks:[...m.tasks,{code:`NV-${m.tasks.length+1}`,task_name:'',assigned_unit:'',deadline:'',requirements:''}]})}>Thêm nhiệm vụ</button>
      <label className="block">Nội dung kết thúc<textarea className={field} rows={3} value={m.closing_statement} onChange={e=>update({...m,closing_statement:e.target.value})}/></label>
      <label className="block text-sm"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/> Tôi đã đối chiếu nội dung, tên người phát biểu, kết luận và nhiệm vụ; biên bản đủ điều kiện ban hành.</label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex gap-3"><button type="button" className="border rounded p-2" onClick={()=>{setError('');onSave().catch(()=>setError('Không lưu được dự thảo.'));}}>Lưu dự thảo</button>
      <button type="button" disabled={!checked} className="bg-[#0A1E60] text-white rounded p-2 disabled:opacity-50" onClick={async()=>{setError('');try{await onApprove(m);setChecked(false);}catch{setError('Không lưu được xác nhận. Nội dung vẫn được giữ; hãy thử lưu lại.');}}}>Xác nhận & lưu biên bản</button></div>
      <p className="text-xs text-slate-500">Sau xác nhận có thể xuất Word / PDF. Chỉnh sửa nội dung hoặc thông tin cuộc họp cần xác nhận lại.</p>
    </fieldset>
  </details>;
}
