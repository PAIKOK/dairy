import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
 plugins:[react()],cacheDir:'.cache/vite',
 server:{host:'127.0.0.1',port:Number(process.env.CLIENT_PORT||5177),strictPort:true,
  cors:false,forwardConsole:false,
  headers:{'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'},
  fs:{strict:true,deny:['.env','.env.*','**/*.{crt,pem}','**/.git/**','**/server/**','**/*.sqlite','**/*.sqlite-*']},
  proxy:{'/api':`http://127.0.0.1:${process.env.API_PORT||4017}`}
 },build:{sourcemap:false}
});
