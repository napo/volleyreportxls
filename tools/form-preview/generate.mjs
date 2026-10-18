// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Drafts only: production forms and recognition coordinates remain unchanged.
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const meanings = {
 B: { '#':['Ace','good'], '+':['Positiva','good'], '!':['Forzante','good'], '-':['Facile','bad'], '/':['Mezzo|punto','good'], '=':['Errore','bad'] },
 R: { '#':['Perfetta','good'], '+':['Positiva','good'], '!':['Negativa|forzata','bad'], '-':['Insuff.','bad'], '/':['Palla|di là','bad'], '=':['Ace|subito','bad'] },
 A: { '#':['Vincente','good'], '+':['Positivo','good'], '!':['Murato|coperto','mid'], '-':['Difeso|facile','bad'], '/':['Murato','bad'], '=':['Errore','bad'] },
 M: { '#':['Punto','good'], '+':['Rigioco|nostro','good'], '!':['Coperto|avvers.','bad'], '-':['Rigioco|avvers.','bad'], '/':['Fallo|invas.','bad'], '=':['Errore','bad'] },
 P: { '=':['Fallo','bad'] },
};
const colors = { good:[0.89,0.95,0.89], mid:[1,0.96,0.84], bad:[0.98,0.89,0.87] };
const server = await createServer({configFile:false, server:{middlewareMode:true}, plugins:[{
 name:'draft-form', enforce:'pre', transform(code,id) {
  if (!id.endsWith('/src/pdf/scouting-form-pdf.ts')) return;
  return code.replace(/      if \(cell.overflow\) \{[\s\S]*?\n      \}/, '')
   .replace('if (i % 2 === 0) s.fill(', 'if (false) s.fill(')
   .replace('formQrPayload(page)', "'VOLLEYREPORT-DRAFT-NOT-FOR-IMPORT'")
   .replace('const LABEL = rgb(0.45, 0.45, 0.45);', 'const LABEL = rgb(0.25, 0.25, 0.25);');
 }
}]});
try {
 const {renderScoutingFormPdf} = await server.ssrLoadModule('/src/pdf/scouting-form-pdf.ts');
 const {formLayout} = await server.ssrLoadModule('/src/pdf/layout.ts');
 const {TEST_FONTS} = await server.ssrLoadModule('/src/pdf/test-fonts.ts');
 const {it} = await server.ssrLoadModule('/src/i18n/it.ts');
 const mm=72/25.4;
 await mkdir('output/pdf',{recursive:true});
 for(const variant of ['A','B']) {
  const layout=structuredClone(formLayout(6));
  const top=layout.rows[0].outer.y;
  const bottom=Math.max(...layout.rows.map(r=>r.outer.y+r.outer.height));
  const shift=variant==='A'?7:0, shrink=variant==='B'?23:0;
  const scale=(bottom-shrink-top-shift)/(bottom-top);
  const mapY=y=>top+shift+(y-top)*scale;
  const move=o=>{
   if(!o || typeof o!=='object') return;
   if('x' in o && 'y' in o && 'width' in o && 'height' in o){o.y=mapY(o.y);o.height*=scale;return;}
   Object.values(o).forEach(move);
  };
  layout.rows.forEach(move);
  layout.skills.filter(s=>s.kind==='libero').forEach(move);
  layout.numberHeaders.filter(s=>s.kind==='libero').forEach(move);
  // The former overflow slot is a regular bubble in these visual drafts.
  for(const row of layout.rows) for(const cell of row.cells) {
   cell.bubbles.push({...cell.overflow,number:cell.bubbles.length+1});
  }
  const texts={...it,form:{...it.form,
   legend1:'Un pallino per ogni tocco: tutti i pallini hanno lo stesso valore.',
   legend2:'Per continuare: altro foglio, stesso set e stesso numero di divisa.',
   legacyLegend2:'Per continuare: altro foglio, stesso set e stesso numero di divisa.',
   after:()=> 'Colori: verde favorevole · giallo intermedio · rosa sfavorevole. Leggere sempre il testo.',
   legend3:`BOZZA ${variant} - ${variant==='A'?'legende nelle intestazioni':'legenda sotto la griglia'} - non acquisire con l’app`,
   credits:()=> '© 2026 Maurizio Napolitano · CC BY 4.0 · anteprima modificata',
  }};
  const bytes=await renderScoutingFormPdf({fonts:TEST_FONTS,layout,texts});
  const doc=await PDFDocument.load(bytes);doc.registerFontkit(fontkit);
  const font=await doc.embedFont(TEST_FONTS.regular), bold=await doc.embedFont(TEST_FONTS.bold);
  const page=doc.getPages()[0], H=page.getHeight();
  const text=(s,x,y,size=6.2,strong=false)=>page.drawText(s,{x:x*mm,y:H-y*mm,size,font:strong?bold:font,color:rgb(0.12,0.12,0.12)});
  for(const skill of layout.skills) for(const ev of skill.evaluations){
   const [caption,tone]=meanings[skill.skill][ev.evaluation];
   const r=ev.outer, extra=variant==='A'&&skill.kind==='player'?7:0;
   page.drawRectangle({x:r.x*mm,y:H-(r.y+r.height+extra)*mm,width:r.width*mm,height:(r.height+extra)*mm,color:rgb(...colors[tone])});
   const size=skill.kind==='player'?9:7;
   const symW=bold.widthOfTextAtSize(ev.evaluation,size)/mm;
   text(ev.evaluation,r.x+(r.width-symW)/2,r.y+r.height-(skill.kind==='player'?0.6:0.4),size,true);
   if(extra) caption.split('|').forEach((line,i)=>{
    const sz=6.2, w=font.widthOfTextAtSize(line,sz)/mm;
    text(line,r.x+(r.width-w)/2,r.y+r.height+2.5+i*2.5,sz);
   });
  }
  if(variant==='B') {
   const y=bottom-shrink+3;
   const names={B:'BATTUTA',R:'RICEZIONE',A:'ATTACCO',M:'MURO'};
   ['B','R','A','M'].forEach((skill,i)=>{
    const x=7+i*70;
    text(names[skill],x,y,7,true);
    Object.entries(meanings[skill]).forEach(([symbol,[caption]],j)=>text(`${symbol}  ${caption.replace('|',' ')}`,x,y+3+j*2.65,6.7));
   });
   text('Alzata: = fallo sul secondo tocco. Colori: favorevole / intermedio / sfavorevole.',7,bottom+1,6.5);
  }
  doc.setTitle(`Modulo - bozza ${variant} - non utilizzare per acquisizione`);
  await writeFile(`output/pdf/modulo-bozza-${variant}.pdf`,await doc.save());
 }
} finally {await server.close();}
