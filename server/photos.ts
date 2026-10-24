/** Browser uploads are re-encoded to baseline JPEG. Strip APP/COM metadata again server-side,
 * bound decoded dimensions, disallow SVG and trailing payloads, and never use supplied filenames. */
export function sanitizeJpeg(buffer:Buffer):Buffer{
 if(buffer.length<10||buffer[0]!==255||buffer[1]!==216)throw new Error('Upload a JPEG photograph.');
 const pieces=[buffer.subarray(0,2)];let offset=2,dimensions=false;
 while(offset<buffer.length){
  const start=offset;if(buffer[offset++]!==255)throw new Error('Invalid JPEG.');
  const marker=buffer[offset++];if(marker===undefined)break;
  if(marker===218){
   if(!dimensions||buffer[buffer.length-2]!==255||buffer[buffer.length-1]!==217)throw new Error('Invalid JPEG.');
   const length=buffer.readUInt16BE(offset);if(length<2||offset+length>buffer.length-2)throw new Error('Invalid JPEG.');
   for(let i=offset+length;i<buffer.length-2;i++){if(buffer[i]===255){const next=buffer[++i];if(next!==0&&!(next!==undefined&&next>=208&&next<=215))throw new Error('Use a standard JPEG photograph.');}}
   pieces.push(buffer.subarray(start));return Buffer.concat(pieces);
  }
  if(offset+2>buffer.length)break;
  const length=buffer.readUInt16BE(offset);if(length<2||offset+length>buffer.length)throw new Error('Invalid JPEG.');
  if(marker===192){if(length<8)throw new Error('Invalid JPEG.');const height=buffer.readUInt16BE(offset+3),width=buffer.readUInt16BE(offset+5);if(!width||!height||width*height>16000000)throw new Error('That photograph is too large.');dimensions=true;}
  else if(marker!==undefined&&marker>=193&&marker<=207&&![196,200,204].includes(marker))throw new Error('Please re-encode this photo as a standard JPEG.');
  if(marker!==254&&!(marker!==undefined&&marker>=224&&marker<=239))pieces.push(buffer.subarray(start,offset+length));
  offset+=length;
 }
 throw new Error('Invalid JPEG.');
}
