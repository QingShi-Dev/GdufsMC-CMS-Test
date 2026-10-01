// Test repository only. Run trusted code from main, never code from a CMS branch.
import {execFileSync} from "node:child_process";
const repo="QingShi-Dev/GdufsMC-CMS-Test";
if(process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY!==repo)throw Error("Test repository only");
const api=(path,body,method="POST")=>{
 const raw=execFileSync("gh",["api",`repos/${repo}/${path}`,...(body?["--method",method,"--input","-"]:[])],{encoding:"utf8",input:body?JSON.stringify(body):undefined});
 return raw.trim()?JSON.parse(raw):null;
};
const branch="cms/content";
// Server-side merge preserves concurrently added commits; never reset or force-push.
const main=api("git/ref/heads/main").object.sha;
const relation=api(`compare/${main}...cms%2Fcontent`);
if(relation.status==="behind") {
 // Non-force update rejects a racing save rather than discarding it.
 api("git/refs/heads/cms/content",{sha:main,force:false},"PATCH");
 console.log("Fast-forwarded cms/content to main");
} else if(relation.status==="diverged") {
 api("merges",{base:branch,head:main,commit_message:"chore: sync main into CMS work branch"});
}
const diff=api(`compare/${main}...cms%2Fcontent`);
if((diff.files?.length??0)>=300)throw Error("Diff may be truncated; manual review required");
const unexpected=diff.files.filter(f=>![f.filename,f.previous_filename].filter(Boolean).every(p=>p.startsWith("content/")));
if(unexpected.length)throw Error("Non-content changes: "+unexpected.map(f=>f.filename).join(","));
const prs=api("pulls?state=open&base=main&head=QingShi-Dev:cms/content&per_page=100");
if(prs.length>1)throw Error("Duplicate batch PRs require manual review");
if(!diff.files.length){console.log("No content difference; no PR created.");}
else if(prs.length){console.log(`Reused PR #${prs[0].number}; ${diff.files.length} changed files`);}
else{
 try{
 const pr=api("pulls",{title:"CMS content batch",head:branch,base:"main",body:"Batch content review. Human approval and merge required. Use merge commit; retain cms/content."});
 console.log(`Created PR #${pr.number}`);
 }catch(error){
 const concurrent=api("pulls?state=open&base=main&head=QingShi-Dev:cms/content&per_page=100");
 if(concurrent.length!==1)throw error;
 console.log(`Reused concurrently created PR #${concurrent[0].number}`);
 }
}
console.log(JSON.stringify({main,content:api("git/ref/heads/cms/content").object.sha,automaticMerge:false}));
