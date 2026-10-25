import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve('.vercel/output/functions/api/index.func'),metadata=join(root,'.vc-config.json');
assert.ok(existsSync(metadata),'Run vercel build before the native runtime test.');
const config=JSON.parse(readFileSync(metadata,'utf8')),entry=pathToFileURL(join(root,config.handler)).href;
// No tsx/ts-node loader: test the emitted graph exactly as native Node loads it.
// Force missing configuration, so this test cannot connect to or modify a real database.
const script=`import assert from 'node:assert/strict';
 delete process.env.MONGODB_URI; delete process.env.RATE_LIMIT_SECRET;
 process.env.CLIENT_ORIGIN='https://runtime-fixture.invalid';
 const {default:app}=await import(${JSON.stringify(entry)});
 assert.equal(typeof app,'function');
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/status');
  assert.equal(response.status,503);assert.match(response.headers.get('content-type'),/application\\/json/);
  const result=await response.json();assert.match(result.error,/database is not available/);
  console.log('PASS native Vercel function imports without a TypeScript loader');
  console.log('PASS unavailable configuration returns handled JSON 503, not a function startup crash');
 }finally{await new Promise(resolve=>server.close(resolve))}
`;
const child=spawnSync(process.execPath,['--input-type=module','--eval',script],{env:{...process.env,NODE_OPTIONS:'',MONGODB_URI:'',RATE_LIMIT_SECRET:''},encoding:'utf8',timeout:20000});
if(child.stdout)process.stdout.write(child.stdout);
if(child.status!==0){if(child.stderr)process.stderr.write(child.stderr);throw new Error('Native built-function startup failed. A packaging-only success is insufficient.');}
