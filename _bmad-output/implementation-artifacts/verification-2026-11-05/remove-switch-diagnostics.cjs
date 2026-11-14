const fs=require('node:fs'),assert=require('node:assert/strict');
const root='D:/Projects/inquello/';
const edits={
'desktop/src/main/smoke-probe.ts':[
["    const switchStarted=performance.now();\n",""],
["      globalThis.__switchDiagnostic={result,at:performance.now()};\n",""],
["      globalThis.__switchDiagnostic.usage=usage;globalThis.__switchDiagnostic.finished=performance.now();\n",""],
["    console.info(JSON.stringify({event:'visual-switch-diagnostic',elapsed:performance.now()-switchStarted,switched,switchedRoute,detail:await contents.executeJavaScript('globalThis.__switchDiagnostic')}));\n",""]
],
'desktop/src/main/usage/service.ts':[
["{console.info(JSON.stringify({event:'usage-read-diagnostic',stage:'authority',authority,current:current()}));return unavailable();}","return unavailable();"],
["console.info(JSON.stringify({event:'usage-read-diagnostic',stage:'catch',error:String(error),current:current()}));",""]
]};
for(const [p,pairs]of Object.entries(edits)){let source=fs.readFileSync(root+p,'utf8');const crlf=source.includes('\r\n');source=source.replace(/\r\n/g,'\n');for(const [a,b]of pairs){assert.equal(source.split(a).length,2,p+': expected exact unique trace');source=source.replace(a,b);}fs.writeFileSync(root+p,crlf?source.replace(/\n/g,'\r\n'):source);console.log('removed',p);}
