const $=id=>document.getElementById(id);
const say=(t,e)=>{const s=$('status');s.textContent=t;s.className='status'+(e?' err':'')};
let img,pts,doc=null,sc=1;
const show=(id,on)=>$(id).classList.toggle('hide',!on);

$('file').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const im=new Image();im.onload=()=>{img=im;setup();URL.revokeObjectURL(im.src)};
  im.onerror=()=>say('That file could not be opened as an image.',1);
  im.src=URL.createObjectURL(f);
});
$('reset').onclick=()=>{show('s-crop',0);show('s-edit',0);show('s-pick',1);$('file').value='';say('Choose a photo of a document to begin.')};

function setup(){
  const m=1600;sc=Math.min(1,m/Math.max(img.width,img.height));
  const c=$('src');c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  pts=guess(c);drawPoly();show('s-pick',0);show('s-crop',1);show('s-edit',0);
  $('out').getContext('2d').clearRect(0,0,1,1);$('out').width=$('out').height=0;$('read').disabled=true;
  say('Drag the four dots onto the corners of the page, then press Straighten and clean.');
}
function guess(c){ // bounding box of the bright paper area
  const w=80,h=Math.round(80*c.height/c.width),t=document.createElement('canvas');t.width=w;t.height=h;
  const x=t.getContext('2d');x.drawImage(c,0,0,w,h);const d=x.getImageData(0,0,w,h).data;
  let sum=0;const L=[];for(let i=0;i<d.length;i+=4){const l=.3*d[i]+.59*d[i+1]+.11*d[i+2];L.push(l);sum+=l}
  const th=sum/L.length*1.05;let x0=w,x1=0,y0=h,y1=0;
  L.forEach((l,i)=>{if(l>th){const px=i%w,py=(i/w)|0;x0=Math.min(x0,px);x1=Math.max(x1,px);y0=Math.min(y0,py);y1=Math.max(y1,py)}});
  if(x1-x0<w*.3||y1-y0<h*.3){x0=w*.08;x1=w*.92;y0=h*.08;y1=h*.92}
  const W=c.width/w,H=c.height/h;
  return [[x0*W,y0*H],[(x1+1)*W,y0*H],[(x1+1)*W,(y1+1)*H],[x0*W,(y1+1)*H]];
}
function drawPoly(){
  const c=$('src'),box=$('cropbox');box.querySelectorAll('.h').forEach(n=>n.remove());
  const svg=$('poly');svg.setAttribute('viewBox',`0 0 ${c.width} ${c.height}`);
  svg.firstElementChild.setAttribute('points',pts.map(p=>p.join(',')).join(' '));
  pts.forEach((p,i)=>{
    const h=document.createElement('div');h.className='h';h.tabIndex=0;h.setAttribute('aria-label','Corner '+(i+1));
    h.style.left=p[0]/c.width*100+'%';h.style.top=p[1]/c.height*100+'%';
    h.onpointerdown=e=>{h.setPointerCapture(e.pointerId);h.onpointermove=ev=>{
      const r=c.getBoundingClientRect();
      pts[i]=[Math.max(0,Math.min(c.width,(ev.clientX-r.left)/r.width*c.width)),Math.max(0,Math.min(c.height,(ev.clientY-r.top)/r.height*c.height))];
      h.style.left=pts[i][0]/c.width*100+'%';h.style.top=pts[i][1]/c.height*100+'%';
      svg.firstElementChild.setAttribute('points',pts.map(q=>q.join(',')).join(' '))};
      h.onpointerup=()=>{h.onpointermove=null}};
    box.appendChild(h);
  });
}
// perspective warp
function solve(A,b){const n=b.length;for(let i=0;i<n;i++){let m=i;for(let r=i+1;r<n;r++)if(Math.abs(A[r][i])>Math.abs(A[m][i]))m=r;[A[i],A[m]]=[A[m],A[i]];[b[i],b[m]]=[b[m],b[i]];
  for(let r=i+1;r<n;r++){const f=A[r][i]/A[i][i];for(let k=i;k<n;k++)A[r][k]-=f*A[i][k];b[r]-=f*b[i]}}
  const x=Array(n).fill(0);for(let i=n-1;i>=0;i--){let s=b[i];for(let k=i+1;k<n;k++)s-=A[i][k]*x[k];x[i]=s/A[i][i]}return x}
function homography(dst,src){const A=[],b=[];
  for(let i=0;i<4;i++){const[x,y]=dst[i],[u,v]=src[i];
    A.push([x,y,1,0,0,0,-x*u,-y*u]);b.push(u);A.push([0,0,0,x,y,1,-x*v,-y*v]);b.push(v)}
  return solve(A,b)}
$('flat').onclick=()=>{
  const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  let w=Math.max(d(pts[0],pts[1]),d(pts[3],pts[2])),h=Math.max(d(pts[0],pts[3]),d(pts[1],pts[2]));
  if(w<50||h<50){say('The corners are too close together. Spread them out to the page edges.',1);return}
  const k=Math.min(1,1600/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);
  const s=$('src'),sd=s.getContext('2d').getImageData(0,0,s.width,s.height),o=$('out');o.width=w;o.height=h;
  const ox=o.getContext('2d'),od=ox.createImageData(w,h),H=homography([[0,0],[w,0],[w,h],[0,h]],pts);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const z=H[6]*x+H[7]*y+1,u=(H[0]*x+H[1]*y+H[2])/z,v=(H[3]*x+H[4]*y+H[5])/z;
    const x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0,i=(y*w+x)*4;
    if(x0<0||y0<0||x0>=s.width-1||y0>=s.height-1){od.data[i]=od.data[i+1]=od.data[i+2]=255;od.data[i+3]=255;continue}
    for(let c=0;c<3;c++){const g=(xx,yy)=>sd.data[(yy*s.width+xx)*4+c];
      od.data[i+c]=g(x0,y0)*(1-fx)*(1-fy)+g(x0+1,y0)*fx*(1-fy)+g(x0,y0+1)*(1-fx)*fy+g(x0+1,y0+1)*fx*fy}
    od.data[i+3]=255}
  ox.putImageData(od,0,0);clean(o);$('read').disabled=false;say('Page straightened. Press Read the text.');
};
function clean(o){ // remove uneven lighting, then boost contrast
  const w=o.width,h=o.height,ox=o.getContext('2d'),d=ox.getImageData(0,0,w,h);
  const sm=document.createElement('canvas');sm.width=Math.max(8,w>>4);sm.height=Math.max(8,h>>4);
  const sx=sm.getContext('2d');sx.imageSmoothingQuality='high';sx.drawImage(o,0,0,sm.width,sm.height);
  const bg=document.createElement('canvas');bg.width=w;bg.height=h;const bx=bg.getContext('2d');bx.imageSmoothingQuality='high';bx.drawImage(sm,0,0,w,h);
  const b=bx.getImageData(0,0,w,h).data;
  for(let i=0;i<d.data.length;i+=4){
    const g=.3*d.data[i]+.59*d.data[i+1]+.11*d.data[i+2],bl=.3*b[i]+.59*b[i+1]+.11*b[i+2]+1;
    const r=Math.max(0,Math.min(1,(g/bl-.55)/.4))*255;d.data[i]=d.data[i+1]=d.data[i+2]=r}
  ox.putImageData(d,0,0);
}
// read text with Claude
$('read').onclick=async()=>{
  const b=$('read');b.disabled=true;say('Reading the page…');
  try{
    const sample=await claude.use('sample');
    if(!sample){say('Reading is not available in this view. Open the page in claude.ai to use it.',1);b.disabled=false;return}
    const lim=await sample.limits().catch(()=>null);
    if(!lim||!lim.images){say('Image reading is not available in this view.',1);b.disabled=false;return}
    const blob=await new Promise(r=>$('out').toBlob(r,'image/jpeg',.85));
    const prompt=`Transcribe the attached scanned document faithfully. Keep the original wording, language and order. Do not invent text; use "?" for illegible parts.
Return ONLY JSON in this shape:
{"kind":"text"|"table","blocks":[{"type":"heading"|"paragraph"|"list","text":"..."}],"table":null|{"rows":[["cell","cell"]]}}
Rules: "kind" is "table" if the page is mainly a grid such as an attendance list, schedule or grade sheet. Put any title or text outside the grid in "blocks". Put the grid in "table.rows" with the header row first, every row with the same number of cells, empty cells as "". For a "list" block, separate items with newline characters.`;
    doc=await sample.json(prompt,{images:[blob],modelTier:'default',cache:false});
    if(!doc||typeof doc!=='object')throw new Error('Unexpected reply');
    doc.blocks=Array.isArray(doc.blocks)?doc.blocks:[];
    if(doc.table&&!Array.isArray(doc.table.rows))doc.table=null;
    renderEdit();
  }catch(e){say('Could not read the page'+(e&&e.message?': '+e.message:'.')+' Try again with a sharper photo.',1)}
  b.disabled=false;
};
function renderEdit(){
  show('s-edit',1);
  const r=$('ref'),o=$('out');r.width=o.width;r.height=o.height;r.getContext('2d').drawImage(o,0,0);
  $('kind').textContent=doc.kind==='table'?'This looks like a table, so Excel is the best fit. Word works too.':'This looks like a text document, so Word is the best fit.';
  const B=$('blocks');B.innerHTML='';
  doc.blocks.forEach((bl,i)=>{
    const row=document.createElement('div');row.className='blk';
    const s=document.createElement('select');s.setAttribute('aria-label','Block type');
    ['heading','paragraph','list'].forEach(t=>{const op=new Option(t[0].toUpperCase()+t.slice(1),t);if(t===bl.type)op.selected=true;s.add(op)});
    s.onchange=()=>bl.type=s.value;
    const t=document.createElement('textarea');t.value=bl.text||'';t.rows=bl.type==='paragraph'?3:2;t.oninput=()=>bl.text=t.value;
    const x=document.createElement('button');x.className='btn';x.textContent='Remove';x.onclick=()=>{doc.blocks.splice(i,1);renderEdit()};
    row.append(s,t,x);B.append(row)});
  const T=$('tbl');T.innerHTML='';show('tbar',!!doc.table);
  if(doc.table){
    const tb=document.createElement('table');tb.className='ed';
    doc.table.rows.forEach((rw,ri)=>{const tr=tb.insertRow();rw.forEach((v,ci)=>{
      const td=tr.insertCell();td.contentEditable='true';td.textContent=v;if(ri===0)td.style.fontWeight='600';
      td.oninput=()=>doc.table.rows[ri][ci]=td.textContent})});
    T.append(tb)}
  else show('tbar',0);
  say('Check the text against the scan, fix anything that is wrong, then download.');
}
$('addrow').onclick=()=>{const t=doc.table.rows;t.push(Array(t[0].length).fill(''));renderEdit()};
$('addcol').onclick=()=>{doc.table.rows.forEach(r=>r.push(''));renderEdit()};

async function save(name,data){
  try{const d=await claude.use('downloads');if(!d){say('Downloads are not available in this view. Open the page in claude.ai to save files.',1);return}
    await d.save({filename:name,data});say('Saved '+name+'.')}
  catch(e){if(e&&e.code==='declined')say('Download cancelled.');else say('Could not save the file ('+((e&&e.code)||'error')+').',1)}
}
$('dl-docx').onclick=async()=>{
  const D=window.docx;if(!D){say('The Word builder did not load. Check your connection and reload.',1);return}
  const kids=[];
  doc.blocks.forEach(b=>{const tx=(b.text||'').trim();if(!tx)return;
    if(b.type==='heading')kids.push(new D.Paragraph({text:tx,heading:D.HeadingLevel.HEADING_1,spacing:{after:160}}));
    else if(b.type==='list')tx.split('\n').filter(Boolean).forEach(l=>kids.push(new D.Paragraph({text:l.replace(/^[-•*\d.\s]+/,''),bullet:{level:0}})));
    else tx.split('\n').filter(Boolean).forEach(l=>kids.push(new D.Paragraph({text:l,spacing:{after:140}})))});
  if(doc.table){kids.push(new D.Paragraph({text:''}));
    kids.push(new D.Table({width:{size:100,type:D.WidthType.PERCENTAGE},rows:doc.table.rows.map((r,ri)=>new D.TableRow({children:r.map(c=>new D.TableCell({children:[new D.Paragraph({children:[new D.TextRun({text:String(c||''),bold:ri===0})]})]}))}))}))}
  if(!kids.length)kids.push(new D.Paragraph({text:''}));
  const blob=await D.Packer.toBlob(new D.Document({sections:[{children:kids}]}));
  save('scan.docx',blob);
};
$('dl-xlsx').onclick=()=>{
  if(!window.XLSX){say('The Excel builder did not load. Check your connection and reload.',1);return}
  let rows;
  if(doc.table)rows=[...doc.blocks.map(b=>[b.text||'']).filter(r=>r[0]),[],...doc.table.rows];
  else rows=doc.blocks.flatMap(b=>(b.text||'').split('\n').filter(Boolean).map(l=>[l]));
  const ws=XLSX.utils.aoa_to_sheet(rows.length?rows:[['']]),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Scan');
  save('scan.xlsx',new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})));
};