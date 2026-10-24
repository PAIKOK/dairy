import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
if(existsSync('.env'))loadEnvFile('.env');
const apiPort=process.env.API_PORT||process.env.PORT||'4017',clientPort=process.env.CLIENT_PORT||'5177';
const env={...process.env,PORT:apiPort,API_PORT:apiPort,CLIENT_PORT:clientPort,CLIENT_ORIGIN:process.env.CLIENT_ORIGIN||`http://127.0.0.1:${clientPort},http://localhost:${clientPort}`};
const children=[spawn('node',['--import','tsx','--watch','server/index.ts'],{stdio:'inherit',env}),spawn('node',['node_modules/vite/bin/vite.js'],{stdio:'inherit',env})];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const c of children)c.kill('SIGTERM');process.exitCode=code;}
for(const c of children){c.on('error',()=>stop(1));c.on('exit',code=>stop(code||0));}
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>stop());
