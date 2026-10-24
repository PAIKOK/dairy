import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 for(const [label,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',375,812]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:5177/',{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`artifacts/home-${label}.png`,fullPage:true});
  await page.screenshot({path:`artifacts/hero-${label}.png`});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))console.log(await page.evaluate(()=>[...document.querySelectorAll("body *")].map(e=>({tag:e.tagName,c:e.className,x:e.getBoundingClientRect().x,r:e.getBoundingClientRect().right})).filter(e=>e.r>innerWidth+1||e.x< -1)));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${label}: no horizontal overflow`);
  await page.locator('[data-date="2027-05-16"]').click();
  await page.getByRole('heading',{name:'A page waiting for you.'}).waitFor();
  if(width<760){await page.getByRole('button',{name:'Open navigation'}).click();assert.equal(await page.locator('#public-navigation').isVisible(),true);await page.getByRole('button',{name:'Close navigation'}).click();}
  await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
  const issues=await page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.map(n=>n.target)})));
  console.log(label,JSON.stringify({width,overflow:false,calendarSelection:'passed',accessibility:issues}));
  await page.close();
 }
}finally{await browser.close()}
