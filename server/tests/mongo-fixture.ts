import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
export async function temporaryMongo(){
 const cached=join(homedir(),'.cache','mongodb-binaries',`mongod-${process.arch}-${process.platform}-8.2.6`);
 return MongoMemoryReplSet.create({binary:{version:'8.2.6',...(existsSync(cached)?{systemBinary:cached}:{})},replSet:{count:1,storageEngine:'wiredTiger',ip:'127.0.0.1'}});
}
