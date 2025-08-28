import fs from 'node:fs'; import path from 'node:path';
const combos = (a:any[],b:any[])=>a.flatMap(x=>b.map(y=>[...x,y]));
const axes = {
  locale: ['en-US','vi-VN'],
  mode: ['headless','headful'],
  device: ['Desktop','Mobile'],
  network: ['normal','slow3g'],
  block: ['on','off'],
  scroll: [{rounds:120,idle:8,pause:180},{rounds:400,idle:12,pause:240}],
};
let cases:any[]=[];
axes.locale.forEach(L=>{
  axes.mode.forEach(M=>{
    axes.device.forEach(D=>{
      axes.network.forEach(N=>{
        axes.block.forEach(B=>{
          axes.scroll.forEach(S=>{
            cases.push({locale:L,mode:M,device:D,network:N,block:B,scroll:S});
          });
        });
      });
    });
  });
});
const outDir=path.resolve('apps/e2e/scenarios'); fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'sim.cases.json'), JSON.stringify(cases,null,2));
console.log('generated', cases.length);
