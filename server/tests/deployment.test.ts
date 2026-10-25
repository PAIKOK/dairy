import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Vercel rewrites all diary page deep links without swallowing API or asset routes',async()=>{
 const config=JSON.parse(await readFile(new URL('../../vercel.json',import.meta.url),'utf8')) as {framework:string;buildCommand:string;outputDirectory:string;rewrites:{source:string;destination:string}[]};
 assert.equal(config.framework,'vite');assert.equal(config.buildCommand,'npm run check');assert.equal(config.outputDirectory,'dist');
 assert.deepEqual(config.rewrites.find(rule=>rule.source==='/api/:path*'),{source:'/api/:path*',destination:'/api'});
 const matches=(path:string)=>config.rewrites.filter(rule=>rule.destination==='/index.html').some(rule=>rule.source.endsWith('/:path*')?(path===rule.source.slice(0,-7)||path.startsWith(rule.source.slice(0,-7)+'/')):path===rule.source);
 for(const path of ['/signup','/login','/recover','/demo','/demo/calendar','/diary','/diary/day/2027-01-01','/diary/day/2028-02-29','/diary/settings','/privacy','/terms','/cookies','/refunds'])assert.ok(matches(path),'Direct page navigation must reach the React app: '+path);
 for(const path of ['/api','/api/signup','/api/auth/google/options','/api/photos/private-id','/assets/index.js','/life/fonts/fraunces.ttf','/demographic','/diary-export'])assert.equal(matches(path),false,'API and asset requests must never receive HTML fallback: '+path);
 for(const rule of config.rewrites)assert.ok(['/api','/index.html'].includes(rule.destination));
});
