import {chromium} from 'playwright-core';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{const page=await browser.newPage();const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=32;c.height=24;const x=c.getContext('2d');x.fillStyle='#DCEFE5';x.fillRect(0,0,32,24);x.fillStyle='#4D4054';x.fillRect(8,8,16,8);return c.toDataURL('image/jpeg',.85).split(',')[1]});await writeFile('server/tests/photo.jpg',Buffer.from(data,'base64'));console.log('Deterministic browser-encoded JPEG test fixture created.')}finally{await browser.close()}
