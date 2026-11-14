const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root='D:/Projects/inquello',file=path.join(__dirname,'settings-usability-source-manifest-final-20261107.json');
const list=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard','--','engine','desktop'],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}).split('\0').filter(Boolean).sort();
const files=list.map(name=>({path:name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')}));
const data={createdUtc:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),fileCount:files.length,files};
if(process.argv[2]==='check'){
 const previous=JSON.parse(fs.readFileSync(file,'utf8'));
 if(JSON.stringify(previous.files)!==JSON.stringify(files))throw Error('Measured source differs from final verification snapshot');
 console.log(JSON.stringify({ok:true,fileCount:files.length,unchanged:true,head:data.head}));
}else if(process.argv[2]==='create'){
 fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({ok:true,fileCount:files.length,manifest:file,head:data.head}));
}else throw Error('Expected create or check');
