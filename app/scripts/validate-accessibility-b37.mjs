import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const contracts={
 'public/js/client-shell-layout.js':['class="skip-link"','id="main-content"','aria-current="page"','aria-live="polite"','storage-warning'],
 'public/js/accessibility-controller.js':['pendingRoute','preventScroll:true','ArrowDown','ArrowUp','Escape'],
 'public/js/client-chrome-views.js':['Browser storage','storage-setting-warning','Temporary'],
 'public/js/modal-focus-manager.js':['inert','returnFocus','handleTab'],
 'public/admin.html':['class="skip-link"','aria-atomic="true"'],
 'public/admin.js':['id="admin-main"','role="tab"','ArrowRight'],
 'public/js/admin-views.js':['aria-current="page"','role="tablist"','role="tabpanel"','aria-selected=','tabindex=','aria-label="Search trainers"'],
 'public/style.css':['prefers-reduced-motion:reduce','forced-colors:active','.skip-link','.storage-warning'],
 'public/admin.css':['prefers-reduced-motion:reduce','forced-colors:active','.skip-link','focus-visible']
};

export function validateAccessibilitySources(read=(file)=>fs.readFileSync(path.join(root,file),'utf8')){
 const errors=[];
 for(const [file,tokens] of Object.entries(contracts)){
  let source;try{source=read(file);}catch(error){errors.push(`${file}: cannot read (${error.message})`);continue;}
  for(const token of tokens)if(!source.includes(token))errors.push(`${file}: missing ${token}`);
 }
 return errors;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const errors=validateAccessibilitySources();
 if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Accessibility B37 contract PASS (${Object.keys(contracts).length} sources).`);
}
