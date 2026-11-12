const fs=require('node:fs/promises');
const path=require('node:path');
const testUrl=process.env.ACCOUNT_DELETION_TEST_DATABASE_URL;
const parsed=new URL(testUrl);
if(parsed.pathname!=='/vango_account_deletion_test'||parsed.username!=='vango_deletion_test'||!/^\/tmp\/vango-account-deletion\.[A-Za-z0-9]+$/.test(parsed.searchParams.get('host')||''))throw Error('Unsafe upload test database');
require('dotenv').config=()=>({parsed:{}});
process.env.NODE_ENV='test';process.env.DATABASE_URL=testUrl;
const {beginUploadWriter}=require('../../src/services/uploadWriter');
let heldWriter,heldFile;
process.on('message',async({userId,url})=>{
  try{
    if(!/^\/uploads\/account-deletion-test-[A-Za-z0-9-]+\/crashed-process\.jpg$/.test(url))throw Error('Unsafe fixture path');
    heldWriter=await beginUploadWriter(userId,url);
    heldFile=await fs.open(path.resolve(__dirname,'../..',url.slice(1)),'wx');
    await heldFile.write('isolated partial upload');
    process.send({ready:true});
    // Keep both the writer connection and file descriptor alive until the test kills us.
    setInterval(()=>{},1000);
  }catch(error){process.send({ready:false,error:error.message});process.exitCode=1;}
});
