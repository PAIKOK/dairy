import {useRef} from 'react';
import {MONTHS,WEEKDAYS,monthGrid,formatDate,shiftDate} from '../shared/dates';
import {Icon} from './icons';
export function Calendar({year,month,weekStart=1,selected,marked=[],onSelect,onMonth,small=false}:{year:number;month:number;weekStart?:number;selected?:string;marked?:string[];onSelect:(date:string)=>void;onMonth?:(delta:number)=>void;small?:boolean}) {
 const root=useRef<HTMLDivElement>(null);
 function keyboard(e:React.KeyboardEvent<HTMLButtonElement>,key:string) {
  const movement:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  if(e.key in movement){e.preventDefault();const next=shiftDate(key,movement[e.key]!);const button=root.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`);if(button)button.focus();else if(onMonth){onMonth(next<key?-1:1);setTimeout(()=>root.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus(),0);}}
 }
 return <div className={`calendar ${small?'calendar-small':''}`} ref={root}>
  <div className="calendar-top"><h3>{MONTHS[month]} <span>{year}</span></h3>{onMonth&&<div className="calendar-arrows"><button type="button" className="icon-button" aria-label="Previous month" onClick={()=>onMonth(-1)}><Icon name="left" size={17}/></button><button type="button" className="icon-button" aria-label="Next month" onClick={()=>onMonth(1)}><Icon name="right" size={17}/></button></div>}</div>
  <div className="calendar-grid" role="group" aria-label={`${MONTHS[month]} ${year}`}>
   {Array.from({length:7},(_,i)=><span className="calendar-weekday" key={i} aria-hidden="true">{WEEKDAYS[(i+weekStart)%7]?.slice(0,small?1:3)}</span>)}
   {monthGrid(year,month,weekStart).map((date,i)=>date?<button type="button" key={date} data-date={date} aria-label={`${formatDate(date,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}${marked.includes(date)?', has an entry':''}`} aria-pressed={date===selected} className={`calendar-day ${date===selected?'selected':''} ${marked.includes(date)?'has-entry':''}`} onClick={()=>onSelect(date)} onKeyDown={e=>keyboard(e,date)}>{Number(date.slice(8))}{marked.includes(date)&&<i/>}</button>:<span className="calendar-blank" key={`blank${i}`}/>)}
  </div>
 </div>;
}
