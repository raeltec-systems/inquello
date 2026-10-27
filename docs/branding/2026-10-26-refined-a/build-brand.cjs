const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ROOT = __dirname;
const INK = '#191D21';
const BLUE = '#315FB5';
// Original hand-constructed paths. All coordinates remain editable.
const mark = 'M8 44C8 18 21 4 48 4H52C79 4 92 18 92 44V108H72V78C66 84 58 88 47 88C23 88 10 76 8 56H28C30 65 36 70 48 70C63 70 72 61 72 46C72 30 65 22 49 22C35 22 28 29 28 44Z';
// A wider aperture survives better at 16-20 pixels.
const smallMark = 'M8 42C9 17 22 4 48 4H52C79 4 92 18 92 44V108H72V78C66 84 58 88 47 88C24 88 11 77 8 58H29C32 66 38 70 48 70C63 70 72 61 72 46C72 30 65 22 49 22C36 22 29 28 28 42Z';
const glyphs = [
 ['I',0,'M0 0H26V8H21V80H26V88H0V80H5V8H0Z'],
 ['n',38,'M0 24H14V32C18 26 25 22 34 22C50 22 58 32 58 49V88H43V51C43 41 39 36 31 36C21 36 15 43 15 54V88H0Z'],
 ['q',105,'M32 22C12 22 0 36 0 56C0 76 11 90 31 90C39 90 45 87 49 82V108H64V24H50V31C45 25 40 22 32 22ZM32 36C44 36 50 44 50 56C50 68 44 76 32 76C21 76 15 68 15 56C15 44 21 36 32 36Z'],
 ['u',179,'M0 24H15V61C15 71 19 76 27 76C37 76 43 69 43 58V24H58V88H44V80C40 86 33 90 24 90C8 90 0 80 0 63Z'],
 ['e',247,'M63 59H15C16 71 22 77 33 77C42 77 48 74 53 68L63 76C56 86 46 90 33 90C12 90 0 77 0 56C0 36 13 22 33 22C53 22 64 36 64 55V59ZM15 48H49C47 38 42 35 33 35C24 35 18 39 15 48Z'],
 ['l',322,'M0 0H15V70C15 75 17 77 23 77V89H18C6 89 0 83 0 71Z'],
 ['l',355,'M0 0H15V70C15 75 17 77 23 77V89H18C6 89 0 83 0 71Z'],
 ['o',389,'M32 22C12 22 0 35 0 56C0 77 12 90 32 90C52 90 64 77 64 56C64 35 52 22 32 22ZM32 36C43 36 49 43 49 56C49 69 43 76 32 76C21 76 15 69 15 56C15 43 21 36 32 36Z']
];
const markBody = (small=false) => `<path d="${small?smallMark:mark}"/>`;
const wordBody = () => glyphs.map(([letter,x,d])=>`<path data-letter="${letter}" transform="translate(${x} 0)" fill-rule="evenodd" d="${d}"/>`).join('');
const lockupBody = () => `<g transform="translate(0 -2) scale(1.05)">${markBody()}</g><g transform="translate(132 2)">${wordBody()}</g>`;
function svg(viewBox,body,color=INK,title='Inquello') {
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="${color}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>`;
}
function save(name,data) {fs.writeFileSync(path.join(ROOT,name),data);}
function label(x,y,content,size=16,color='#69727E',weight=400) {return `<text x="${x}" y="${y}" fill="${color}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}">${content}</text>`;}
function iconAt(x,y,size,color=INK,small=false) {return `<g fill="${color}" transform="translate(${x} ${y}) scale(${size/112})">${markBody(small)}</g>`;}
function lockAt(x,y,width,color=INK) {return `<g fill="${color}" transform="translate(${x} ${y}) scale(${width/590})">${lockupBody()}</g>`;}
function box(x,y,w,h,fill='#FFFFFF',stroke='#DFE3E8',r=10) {return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;}
function uiText(x,y,t,size=15,color=INK,weight=400) {return label(x,y,t,size,color,weight);}
function sidebar(active='start') {
 return `<rect width="280" height="960" fill="#F3F4F6"/><path d="M280 0V960" stroke="#DFE3E8"/>
 ${lockAt(28,26,152)}
 <rect x="244" y="35" width="14" height="12" rx="2" fill="none" stroke="#808996"/>
 ${box(16,91,248,38,active==='start'?'#E4E7EB':'#F3F4F6','none',8)}
 ${uiText(30,116,'+',21)}${uiText(55,116,'New thread')}${uiText(30,160,'⌕',20)}${uiText(55,160,'Search')}
 ${uiText(31,202,'▣',16)}${uiText(55,202,'Inbox')}${box(234,185,19,19,'#CB901D','none',10)}${uiText(240,200,'2',12,'#FFFFFF',600)}
 ${uiText(31,245,'◷',17)}${uiText(55,245,'Automations')}${uiText(30,288,'◇',20)}${uiText(55,288,'Skills &amp; procedures')}
 ${uiText(27,336,'WORKSPACES',11,'#88929F',600)}${uiText(242,336,'+',14,'#88929F')}
 ${uiText(27,376,'▾',14,'#8A93A0')}${uiText(45,376,'Meridian Freight · FY26',14,INK,600)}
 ${uiText(44,407,'Cash — September 2026',12,'#8A93A0')}
 ${box(16,423,248,38,active==='review'?'#FFFFFF':'#F3F4F6',active==='review'?'#DFE3E8':'none',8)}
 <circle cx="37" cy="442" r="6" fill="#2F805A"/>${uiText(51,447,'Reconcile bank to ledger',13,INK,600)}
 ${uiText(61,482,'Duplicate check',12,'#627082')}${uiText(61,512,'Payment variance',12,'#627082')}${uiText(61,542,'Bank-only receipt',12,'#627082')}
 ${uiText(61,572,'Subsequent clearance',12,'#627082')}
 ${uiText(45,618,'Draft bank confirmation',13,'#5A6677')}${uiText(45,654,'Revenue cut-off sampling',13,'#5A6677')}
 ${uiText(27,704,'▸',14,'#8A93A0')}${uiText(45,704,'Kijani Microfinance',14,INK,600)}
 ${uiText(27,745,'▸',14,'#8A93A0')}${uiText(45,745,'Q3 vendor review',14,INK,600)}
 ${uiText(27,792,'CHATS',11,'#88929F',600)}${uiText(27,825,'IFRS 9 staging question',13,'#5A6677')}
 <path d="M16 894H264" stroke="#DFE3E8"/><circle cx="39" cy="925" r="17" fill="#DEE7F7"/>${uiText(29,930,'PR',11,BLUE,600)}
 ${uiText(67,921,'Priya Raman',13,INK,600)}${uiText(67,941,'Northgate Assurance',11,'#88929F')}`;
}
function appStart() {
 return `<rect width="1600" height="960" fill="#FFFFFF"/>${sidebar('start')}
 ${uiText(308,43,'New thread',14,'#8A93A0')}
 ${uiText(684,236,'What should we work on?',34,INK,600)}
 ${uiText(493,274,'Describe the task in your own words. Bring files with @ and a procedure or skill with /.',16,'#697587')}
 ${box(426,322,1028,214,'#FFFFFF','#CED5DE',18)}
 ${uiText(450,367,'Compare the bank statement with the cash ledger, investigate the differences, and prepare',17)}
 ${uiText(450,397,'a reconciliation workbook and a short review note.',17)}
 ${box(447,477,34,34,'#FFFFFF','#D8DEE6',17)}${uiText(458,501,'+',20)}
 ${box(490,477,82,34,'#FFFFFF','#D8DEE6',17)}${uiText(506,499,'@ Files',13,'#4F5C6F')}
 ${box(581,477,159,34,'#FFFFFF','#D8DEE6',17)}${uiText(596,499,'/ Skill or procedure',13,'#4F5C6F')}
 <circle cx="1418" cy="494" r="21" fill="${INK}"/>${uiText(1410,502,'↑',23,'#FFFFFF')}
 ${uiText(437,579,'Meridian Freight · FY26   ▾     Draft copy   ▾     Read sources, write drafts   ▾     Thorough   ▾',14,'#697587')}
 ${uiText(437,641,'Your request mentions',14,'#697587')}
 ${box(616,620,310,34,'#FFFFFF','#D8DEE6',6)}${uiText(631,642,'PDF   Bank statement Sep 2026   +',13)}
 ${box(937,620,266,34,'#FFFFFF','#D8DEE6',6)}${uiText(952,642,'XLS   Cash ledger GL1010   +',13)}
 ${uiText(437,708,'Procedures and skills in this workspace',14,'#8A93A0')}
 ${[[426,326,'CR-03 Cash reconciliation','Firm methodology · v3 · 6 steps'],[765,326,'Bank confirmation request','Template · drafts a confirmation letter'],[1104,350,'Journal entry testing','Your skill · risk-based selection']].map(([x,w,title,sub])=>box(x,730,w,102)+uiText(x+16,759,'/  '+title,14,INK,600)+uiText(x+16,787,sub,12,'#7A8594')).join('')}
 ${uiText(442,814,'Matches your request',12,BLUE)}
 ${uiText(308,935,'Brand placement study · recreated from the supplied prototype',11,'#8A93A0')}`;
}
function appReview() {
 return `<rect width="1600" height="960" fill="#FFFFFF"/>${sidebar('review')}
 ${uiText(306,43,'Reconcile bank to ledger',17,INK,600)}${uiText(530,43,'Meridian Freight · FY26',13,'#8A93A0')}
 ${box(713,23,79,28,'#FFFFFF','#D7DDE5',5)}${uiText(726,42,'Draft copy',12,'#59687B')}
 ${box(1218,20,151,34)}${uiText(1235,42,'Open in Excel  ▾',13,INK,600)}${box(1380,20,194,34,'#F0F2F5','none',7)}${uiText(1400,42,'Changes  +53   2 files',13)}
 <path d="M280 72H1600M1040 72V960" stroke="#DFE3E8"/>
 ${box(436,112,558,96,'#F0F2F5','none',16)}
 ${uiText(455,143,'Compare the bank statement with the cash ledger,',15)}${uiText(455,168,'investigate the differences, and prepare a reconciliation',15)}${uiText(455,193,'workbook and a short review note.',15)}
 ${box(316,247,32,32,INK,'none',9)}${iconAt(325,252,22,'#FFFFFF')}${uiText(360,269,'Inquello',15,INK,600)}${uiText(435,269,'Worked for 6m 05s · 4 specialists',12,'#8A93A0')}
 ${uiText(316,312,'The workbook and review note are ready on the draft copy.',15)}
 ${uiText(316,338,'The 150 difference is explained by four reconciling items.',15)}
 ${uiText(316,364,'R1 and R2 need your confirmation; R3 is open and R4 is waiting.',15)}
 ${box(316,391,690,240,'#FFFFFF','#DFE3E8',12)}
 ${[['R1','Possible duplicate receipt','(500.00) · Arden Retail receipt, twice','Suggested'],['R2','Discount not recorded in ledger','(50.00) · Kestrel Supplies payment','Suggested'],['R3','Unidentified receipt — ask client','(300.00) · Solway Logistics transfer','Open'],['R4','Deposit in transit','700.00 · Harbour Foods receipt','Awaiting client']].map((row,i)=>{const y=391+i*60;return `${i?`<path d="M316 ${y}H1006" stroke="#E5E8ED"/>`:''}${uiText(332,y+28,row[0],13,INK,600)}${uiText(375,y+24,row[1],14)}${uiText(375,y+45,row[2],12,'#8A93A0')}${uiText(904,y+33,row[3],11,i===3?'#A06A12':BLUE)}`;}).join('')}
 ${box(316,654,690,127,'#FAFBFC','#DFE3E8',10)}${uiText(332,683,'2 files changed on the draft copy',14,INK,600)}${uiText(883,683,'Review changes',13,BLUE)}
 <path d="M316 698H1006M316 741H1006" stroke="#E5E8ED"/>
 ${uiText(332,724,'XLS',11,'#337A60')}${uiText(369,724,'Cash rec Sep 2026.xlsx',14)}${uiText(880,724,'4 sheets · +46',12,'#8A93A0')}
 ${uiText(332,767,'DOC',11,BLUE)}${uiText(369,767,'Review note.docx',14)}${uiText(855,767,'1 page · 7 paragraphs',12,'#8A93A0')}
 ${box(316,815,690,106,'#FFFFFF','#D0D7E0',16)}${uiText(334,847,'Ask a follow-up or give the next instruction',14,'#8A93A0')}${uiText(334,899,'+     @ files · / skills, procedures and commands',13,'#8A93A0')}
 ${uiText(1064,105,'Changes 2',13,'#697587')}${box(1158,80,80,36,'#EEF1F4','none',6)}${uiText(1173,104,'Preview',13,INK,600)}${uiText(1262,105,'Summary',13,'#697587')}
 <path d="M1040 121H1600" stroke="#DFE3E8"/>
 ${uiText(1062,158,'XLS',11,'#337A60')}${uiText(1095,158,'Cash rec Sep 2026.xlsx',15,INK,600)}${uiText(1480,158,'Draft · v4',12,'#8A93A0')}
 ${box(1058,185,524,38,'#F9FAFC','#E3E7EC',5)}${uiText(1071,209,'Summary',12,'#697587')}${box(1150,185,164,38,INK,'none',0)}${uiText(1163,209,'Reconciling items',12,'#FFFFFF',600)}${uiText(1331,209,'Bank vs ledger',12,'#697587')}${uiText(1488,209,'Notes',12,'#697587')}
 ${box(1058,239,524,451,'#FFFFFF','#E3E7EC',6)}
 ${uiText(1074,269,'Meridian Freight · Bank reconciliation',14,INK,600)}${uiText(1074,293,'Nordbank ••4471 · 30 Sep 2026',12,'#7C8796')}
 ${[['Balance per bank statement','4,750.00'],['Balance per cash ledger','4,600.00'],['Difference','150.00']].map((r,i)=>uiText(1074,337+i*36,r[0],13,INK,i===2?600:400)+uiText(1484,337+i*36,r[1],13,INK,i===2?600:400)).join('')}
 <path d="M1058 430H1582" stroke="#E3E7EC"/>${box(1059,431,522,36,'#F4F6F9','none',0)}${uiText(1073,455,'Ref',11,'#697587')}${uiText(1112,455,'Item',11,'#697587')}${uiText(1399,455,'Adj.',11,'#697587')}${uiText(1491,455,'Status',11,'#697587')}
 ${[['R1','Arden Retail receipt, twice','(500.00)','Suggested'],['R2','Kestrel Supplies payment','(50.00)','Suggested'],['R3','Solway Logistics transfer','(300.00)','Open'],['R4','Harbour Foods receipt','700.00','Waiting']].map((r,i)=>{let y=499+i*44;return `${uiText(1073,y,r[0],12,INK,600)}${uiText(1112,y,r[1],12)}${uiText(1393,y,r[2],12)}${uiText(1491,y,r[3],11,i===3?'#A06A12':BLUE)}<path d="M1058 ${y+13}H1582" stroke="#EEF0F3"/>`;}).join('')}
 ${box(1058,712,524,180,'#F9FAFC','#E3E7EC',10)}
 ${iconAt(1078,734,24)}${uiText(1108,754,'Inquello',14,INK,600)}${uiText(1180,754,'Review note',12,'#8A93A0')}
 ${uiText(1078,791,'The duplicate classification remains a suggestion.',13)}${uiText(1078,817,'Bank confirmation is still needed before a conclusion.',13)}${uiText(1078,858,'View supporting evidence →',13,BLUE)}
 ${uiText(1058,937,'Brand placement study · illustrative UI',11,'#8A93A0')}`;
}
async function build() {
 for (const [suffix,color] of [['ink',INK],['white','#FFFFFF'],['blue',BLUE]]) {
  save(`assets/inquello-symbol-${suffix}.svg`,svg('0 0 100 112',markBody(),color,'Inquello symbol'));
  save(`assets/inquello-wordmark-${suffix}.svg`,svg('-2 -2 457 112',wordBody(),color,'Inquello wordmark'));
  save(`assets/inquello-lockup-${suffix}.svg`,svg('0 0 590 116',lockupBody(),color,'Inquello'));
 }
 save('assets/inquello-symbol-small.svg',svg('0 0 100 112',markBody(true),INK,'Inquello small-size symbol'));
 save('assets/inquello-symbol-currentcolor.svg',svg('0 0 100 112',markBody(),'currentColor','Inquello symbol'));
 save('assets/inquello-lockup-currentcolor.svg',svg('0 0 590 116',lockupBody(),'currentColor','Inquello'));
 save('assets/inquello-app-icon.svg',svg('0 0 128 128',`<rect width="128" height="128" rx="28" fill="${INK}"/><g transform="translate(31.85 28) scale(.643)">${markBody()}</g>`,'#FFFFFF','Inquello app icon'));
 save('assets/inquello-app-icon-light.svg',svg('0 0 128 128',`<rect width="128" height="128" rx="28" fill="#F0F2F5"/><g transform="translate(31.85 28) scale(.643)">${markBody()}</g>`,INK,'Inquello app icon, light'));
 const board = `<rect width="1600" height="1040" fill="#FFFFFF"/>
 ${label(72,64,'INQUELLO   /   OPEN INQUIRY',16,INK,600)}${label(1528,64,'01',16)}
 ${lockAt(190,164,1210)}
 ${label(190,444,'A clearer q. A calmer balance. Lettering drawn for the name.',24,INK)}
 <path d="M72 502H1528" stroke="#E0E4E8"/>
 <rect x="72" y="546" width="284" height="258" rx="20" fill="#F1F3F5"/>
 ${iconAt(156,586,166)}${label(96,778,'PRIMARY SYMBOL',13)}
 <rect x="380" y="546" width="284" height="258" rx="20" fill="${INK}"/>
 ${iconAt(464,586,166,'#FFFFFF')}${label(404,778,'REVERSED',13,'#C9CFD6')}
 ${label(720,568,'CUSTOM WORDMARK',13)}
 <g transform="translate(720 608) scale(1.65)" fill="${INK}">${wordBody()}</g>
 ${label(720,820,'Outline lettering · no font dependency',16)}
 <path d="M72 866H1528" stroke="#E0E4E8"/>
 ${label(72,912,'ACTUAL-SIZE SYMBOLS',13)}
 ${[16,20,24,32,64].map((size,i)=>iconAt(335+i*105,899,size,INK,size<=20)+label(335+i*105,994,String(size)+' px',13)).join('')}
 ${lockAt(1090,909,220)}${label(1090,994,'SIDEBAR LOCKUP',13)}
 ${label(1390,994,'SVG / v1',13)}`;
 save('previews/identity-board.svg',svg('0 0 1600 1040',board,INK,'Inquello refined identity board'));
 await sharp(Buffer.from(svg('0 0 1600 1040',board))).png().toFile(path.join(ROOT,'previews/identity-board.png'));
 for(const size of [16,20,24,32,64,128,256,512]) {
  const source=svg('0 0 100 112',markBody(size<=20));
  await sharp(Buffer.from(source)).resize({height:size}).png().toFile(path.join(ROOT,`assets/inquello-symbol-${size}px.png`));
 }
 await sharp(Buffer.from(svg('0 0 590 116',lockupBody()))).resize({width:1600}).png().toFile(path.join(ROOT,'assets/inquello-lockup.png'));
 for (const [name,body] of [['app-start',appStart()],['app-review',appReview()]]) {
  const content=svg('0 0 1600 960',body,INK,'Inquello '+name+' brand placement study');
  save(`previews/${name}.svg`,content);
  await sharp(Buffer.from(content)).png().toFile(path.join(ROOT,`previews/${name}.png`));
 }
 save('geometry.json',JSON.stringify({version:'refined-a-v1',colors:{ink:INK,blue:BLUE},symbol:{viewBox:'0 0 100 112',path:mark,smallPath:smallMark},wordmark:{viewBox:'-2 -2 457 112',glyphs:glyphs.map(([letter,x,d])=>({letter,x,d}))}},null,2));
 console.log('SVG masters and identity preview created.');
}
build().catch(e=>{console.error(e);process.exit(1)});
