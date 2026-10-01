// Deliberately narrow check: changed paths/formats only, not full content quality.
import {execFileSync} from "node:child_process";
const repo="QingShi-Dev/GdufsMC-CMS-Test";
const api=(path,body)=>{const raw=execFileSync("gh",["api",`repos/${repo}/${path}`,...(body?["--method","POST","--input","-"]:[])],{encoding:"utf8",input:body?JSON.stringify(body):undefined,maxBuffer:16*1024*1024});return raw.trim()?JSON.parse(raw):null;};
const head=api("git/ref/heads/cms/content").object.sha;
const base=api("git/ref/heads/main").object.sha;
const context="cms/content-paths";
const status=(state,description)=>api(`statuses/${head}`,{state,context,description});
status("pending","Checking changed content paths and image signatures");
try{
 const diff=api(`compare/${base}...${head}`);
 if(diff.files.length>=300)throw Error("Diff limit reached; manual review required");
 const tree=api(`git/trees/${head}?recursive=1`);
 if(tree.truncated)throw Error("Tree truncated");
 for(const f of diff.files){
  for(const p of [f.filename,f.previous_filename].filter(Boolean)){
   if(!/^content\/(news\/[^/]+\.md|news\/images\/[^/]+\.(webp|gif|svg)|leaderboard\/index\.yml)$/i.test(p))throw Error(`Unsupported content path: ${p}`);
  }
  if(f.status==="removed")continue;
  const entry=tree.tree.find(x=>x.path===f.filename);
  if(!entry||entry.mode!=="100644")throw Error(`Unsupported mode: ${f.filename}`);
  if(/\.webp$/i.test(f.filename)){
   const b=api(`git/blobs/${entry.sha}`);const bytes=Buffer.from(b.content,"base64");
   if(bytes.length<12||bytes.toString("ascii",0,4)!=="RIFF"||bytes.toString("ascii",8,12)!=="WEBP")throw Error(`Invalid WebP signature: ${f.filename}`);
  }
 }
 status("success","Changed paths, file modes and WebP signatures passed");
 console.log(JSON.stringify({base,head,files:diff.files.length,context,scope:"Not schema, dimensions, references or full image decode"}));
}catch(error){status("failure","Content path/format check failed; see workflow log");throw error;}
