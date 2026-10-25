import {spawn} from 'node:child_process';
import net from 'node:net';
import {temporaryMongo} from '../server/tests/mongo-fixture.ts';
import {MongoStore} from '../server/mongo-store.ts';
import {createApp} from '../server/app.ts';
const reserve=net.createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
const origin=`http://127.0.0.1:${port}`,replica=await temporaryMongo();let store,server;
try{
 store=await MongoStore.connect(replica.getUri(),'little_life_browser_test');
 const {app}=createApp({store,origin});server=app.listen(port,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const child=spawn(process.execPath,['scripts/browser-test.mjs'],{stdio:'inherit',env:{...process.env,TEST_URL:origin}});
 process.exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve(code??1))});
}finally{if(server)await new Promise(resolve=>server.close(resolve));if(store)await store.close();await replica.stop()}
