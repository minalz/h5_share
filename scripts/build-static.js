'use strict';
// Produce a static-only deploy folder from an explicit runtime allowlist.
const fs=require('node:fs/promises');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),DEST=path.join(ROOT,'dist');
const MARKER='.h5-share-build.json';
async function removeGenerated(directory, markerRequired) {
  const absolute=path.resolve(directory),relative=path.relative(ROOT,absolute);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Refusing to remove a path outside this project.');
  let stat;
  try{stat=await fs.lstat(absolute);}catch(error){if(error.code==='ENOENT')return;throw error;}
  const real=await fs.realpath(absolute),realRelative=path.relative(await fs.realpath(ROOT),real);
  if(stat.isSymbolicLink()||!stat.isDirectory()||!realRelative||realRelative.startsWith('..')||path.isAbsolute(realRelative))throw new Error('Unsafe deployment directory.');
  if(markerRequired){
    const metadata=JSON.parse(await fs.readFile(path.join(absolute,MARKER),'utf8'));
    if(metadata.project!=='h5_share'||metadata.kind!=='static-deployment')throw new Error('This dist folder was not created by the deployment builder.');
  }else if(!path.basename(absolute).startsWith('.h5-static-build-'))throw new Error('Unexpected staging folder.');
  await fs.rm(absolute,{recursive:true,force:true});
}
async function main(){
  const manifest=JSON.parse(await fs.readFile(path.join(ROOT,'assets/avatars/manifest.json'),'utf8'));
  const files=['index.html','detail.html','detail-store.js','detail-page.js','manifest.webmanifest','styles.css','app.js','profile-cache.js','moments-view.js','assets/avatars/manifest.json'];
  for(const item of manifest){
    if(!/^assets\/avatars\/(women|men|daily|cartoon)-\d+\.jpg$/.test(item.path))throw new Error('Unexpected avatar path: '+item.path);
    files.push(item.path);
  }
  if(new Set(files).size!==files.length)throw new Error('Duplicate deployment file.');
  const staging=await fs.mkdtemp(path.join(ROOT,'.h5-static-build-'));
  let bytes=0;
  try{
    for(const file of files){
      const from=path.join(ROOT,file),to=path.join(staging,file);
      await fs.mkdir(path.dirname(to),{recursive:true});
      // Provenance and source-sheet metadata stay in the development manifest.
      // The browser needs only these fields; keep all 100 original image files.
      if(file==='assets/avatars/manifest.json'){
        const runtime=manifest.map(({id,category,path,width,height})=>({id,category,path,width,height}));
        await fs.writeFile(to,JSON.stringify(runtime)+'\n');
      }else await fs.copyFile(from,to);
      bytes+=(await fs.stat(to)).size;
    }
    await fs.writeFile(path.join(staging,MARKER),JSON.stringify({project:'h5_share',kind:'static-deployment',files:files.length,bytes},null,2)+'\n');
    await removeGenerated(DEST,true);
    await fs.rename(staging,DEST);
    console.log(`Static deployment ready: ${DEST}\n${files.length} runtime files, ${bytes} bytes. Upload the contents of dist to your website directory.`);
  }finally{await removeGenerated(staging,false);}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
