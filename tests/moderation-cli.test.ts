import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile,spawn } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { isolatedStore,reserve } from "./helpers/moderation.ts";
import { storeUpload } from "../lib/media/storage.ts";
import { verifyPassword } from "../lib/server/http.ts";
const execute=promisify(execFile);

test("trusted admin CLI starts, creates a hashed account and refuses duplicate/weak credentials",async t=>{
  const {store,root}=isolatedStore(t);const password="Synthetic-command-password-123";
  const args=["--conditions=react-server","--import","tsx","scripts/admin-create.ts","cli-reviewer","reviewer"];
  const options={env:{...process.env,PANO_PRIVATE_DIR:root,PANO_ADMIN_PASSWORD:password},windowsHide:true,timeout:15000};
  const output=await execute(process.execPath,args,options);assert.match(output.stdout,/Created reviewer account/);assert.ok(!output.stdout.includes(password));assert.equal(store.admin("cli-reviewer")!.role,"reviewer");assert.equal(verifyPassword(password,store.admin("cli-reviewer")!.password_hash),true);
  await assert.rejects(execute(process.execPath,args,options));
  await assert.rejects(execute(process.execPath,[...args.slice(0,-2),"weak-user","admin"],{...options,env:{...options.env,PANO_ADMIN_PASSWORD:"short"}}));assert.equal(store.admin("weak-user"),undefined);
});

test("real standalone worker starts and holds a real upload with no scanner configured",async t=>{
  const {store,root}=isolatedStore(t),asset=reserve(store);
  const bytes=await sharp({create:{width:32,height:32,channels:3,background:"#226688"}}).png().toBuffer();
  const saved=await storeUpload(asset.id,new Request("http://local/upload",{method:"POST",body:new Uint8Array(bytes)}),10485760);store.finishUpload(asset.id,saved.size,saved.hash);
  const worker=spawn(process.execPath,["--conditions=react-server","--import","tsx","scripts/moderation-worker.ts"],{env:{...process.env,PANO_PRIVATE_DIR:root,CLAMSCAN_PATH:"",MODERATION_PROVIDER:"disabled"},windowsHide:true,stdio:["ignore","pipe","pipe"]});
  let output="",errors="";worker.stdout.on("data",chunk=>{output+=chunk;});worker.stderr.on("data",chunk=>{errors+=chunk;});
  try{const deadline=Date.now()+15000;while(Date.now()<deadline&&store.asset(asset.id)!.status!=="manual_review"){if(worker.exitCode!==null)throw new Error(`Worker unexpectedly stopped: ${errors}`);await new Promise(resolve=>setTimeout(resolve,50));}assert.match(output,/moderation_worker_ready/);assert.equal(store.asset(asset.id)!.status,"manual_review");assert.match(store.asset(asset.id)!.reason_codes,/SECURITY_SCANNER_UNAVAILABLE/);assert.equal(errors,"");}
  finally{if(worker.exitCode===null){const stopped=new Promise(resolve=>worker.once("exit",resolve));worker.kill();await stopped;}}
});
