const fs = require('fs');
const path = require('path');

const wsDir = process.cwd();
const indexHtml = fs.readFileSync(path.join(wsDir, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(wsDir, 'js/app.js'), 'utf8');
const bentoJs = fs.readFileSync(path.join(wsDir, 'js/bento-integration.js'), 'utf8');
const speechJs = fs.readFileSync(path.join(wsDir, 'js/speech-ai.js'), 'utf8');
const importJs = fs.readFileSync(path.join(wsDir, 'js/import-engine.js'), 'utf8');
const themeJs = fs.readFileSync(path.join(wsDir, 'js/theme-manager.js'), 'utf8');
const bentoCss = fs.readFileSync(path.join(wsDir, 'css/bento-theme.css'), 'utf8');
const mainCss = fs.readFileSync(path.join(wsDir, 'css/main.css'), 'utf8');

const allJs = [appJs, bentoJs, speechJs, importJs, themeJs].join('\n');

console.log('====================================================');
console.log('=== SCRIPTUREFLOW STUDIO DIAGNOSTIC REPORT ===');
console.log('====================================================\n');

// 1. INLINE ONCLICK VALIDATION
console.log('--- 1. INLINE ONCLICK VALIDATION ---');
const onclickRegex = /onclick=[']([^']+)[']/g;
let match;
let missingOnclicks = [];
let validOnclicks = 0;
while ((match = onclickRegex.exec(indexHtml)) !== null) {
 const code = match[1].trim();
 const fnMatch = code.match(/^([a-zA-Z0-9_$]+)\s*\(/);
 if (fnMatch) {
 const fn = fnMatch[1];
 const fnRegex = new RegExp('(?:function\\s+' + fn + '\\b|window\\.' + fn + '\\s*=|' + fn + '\\s*=\\s*function|' + fn + '\\s*=\\s*\\()');
 if (!fnRegex.test(allJs)) {
 missingOnclicks.push({ code, fn });
 } else {
 validOnclicks++;
 }
 } else {
 validOnclicks++;
 }
}
console.log('Valid inline onclicks: ' + validOnclicks + ', Missing/Broken handlers: ' + missingOnclicks.length);
if (missingOnclicks.length > 0) {
 console.log('BROKEN ONCLICK HANDLERS:');
 missingOnclicks.forEach(m => console.log(' - fn: ' + m.fn + '() in code: ' + m.code));
}

// 2. BUTTONS IN HTML
console.log('\n--- 2. BUTTONS IN HTML & ACTION BINDING ---');
const buttonRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
let btnMatch;
let totalButtons = 0;
let buttonsWithoutAction = [];
let buttonsWithDisabled = [];
let buttonsWithOnclick = 0;
let buttonsWithId = 0;

while ((btnMatch = buttonRegex.exec(indexHtml)) !== null) {
 totalButtons++;
 const attrs = btnMatch[1];
 const text = btnMatch[2].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
 const idMatch = attrs.match(/id=[']([^']+)[']/);
  const onclickMatch = attrs.match(/onclick=[']([^']+)[']/);
 const classMatch = attrs.match(/class=[']([^']+)[']/);
  const titleMatch = attrs.match(/title=[']([^']+)[']/);
 const disabled = /disabled/i.test(attrs);
 const id = idMatch ? idMatch[1] : null;
 const classes = classMatch ? classMatch[1] : '';
 const title = titleMatch ? titleMatch[1] : '';

 if (onclickMatch) buttonsWithOnclick++;
 if (id) buttonsWithId++;
 if (disabled) buttonsWithDisabled.push({ id, text, title });

 let hasJsBinding = false;
 if (id) {
 const idRegex = new RegExp(['][']);
 if (idRegex.test(allJs)) {
 hasJsBinding = true;
 }
 }
 if (classes) {
 const classList = classes.split(/\s+/);
 for (const c of classList) {
 if (c && (new RegExp([']\\.[']).test(allJs) || new RegExp(getElementsByClassName\\(['][']\\)).test(allJs))) {
 hasJsBinding = true;
 break;
 }
 }
 }

 if (!onclickMatch && !hasJsBinding) {
 buttonsWithoutAction.push({ id, text: text.slice(0, 40), classes, title });
 }
}

console.log(Total <button> elements: );
console.log(Buttons with onclick: );
console.log(Buttons with ID: );
console.log(Buttons with disabled: );
console.log(Buttons completely UNBOUND ():);
buttonsWithoutAction.forEach(b => console.log(' [id: ' + (b.id || 'NONE') + ', class: ' + b.classes + ', title: ' + b.title + ', text: ' + b.text + ']'));

// 3. INTERVALS, TIMERS, AND ANIMATION LOOPS
console.log('\n--- 3. TIMERS & REPEATED EXECUTION IN JS ---');
const setIntervalMatches = allJs.match(/setInterval\s*\(/g) || [];
const setTimeoutMatches = allJs.match(/setTimeout\s*\(/g) || [];
const rafMatches = allJs.match(/requestAnimationFrame\s*\(/g) || [];
console.log(setInterval calls: );
console.log(setTimeout calls: );
console.log(equestAnimationFrame calls: );

// Find all setIntervals with their intervals and context
const lines = appJs.split('\n');
lines.forEach((line, idx) => {
 if (line.includes('setInterval(')) {
 console.log( app.js: -> );
 }
});
const bentoLines = bentoJs.split('\n');
bentoLines.forEach((line, idx) => {
 if (line.includes('setInterval(')) {
 console.log( bento-integration.js: -> );
 }
});

// 4. CHECK SLUGGISHNESS PATTERNS
console.log('\n--- 4. SLUGGISHNESS & PERFORMANCE PATTERNS ---');
const backdropFilters = (bentoCss + '\n' + mainCss).match(/backdrop-filter:[^;]+;/g) || [];
console.log(CSS backdrop-filter count: );
const boxShadows = (bentoCss + '\n' + mainCss).match(/box-shadow:[^;]+;/g) || [];
console.log(CSS box-shadow count: );
const blurFilters = (bentoCss + '\n' + mainCss).match(/filter:\s*blur\([^)]+\);/g) || [];
console.log(CSS blur filter count: );

// Check for heavy global listeners
console.log('\n--- 5. EVENT LISTENERS ---');
console.log(Scroll listeners: );
console.log(Mousemove listeners: );
console.log(Resize listeners: );
console.log(Input listeners: );

// 6. MISSING DOM IDS REFERENCED IN JS
console.log('\n--- 6. DOM IDS REFERENCED IN JS BUT NOT IN HTML ---');
const getElemRegex = /getElementById\s*\(\s*[']([^']+)[']\s*\)/g;
let geMatch;
const missingIds = new Set();
while ((geMatch = getElemRegex.exec(allJs)) !== null) {
  const id = geMatch[1];
  if (!indexHtml.includes(id=") && !indexHtml.includes(id='')) {
 missingIds.add(id);
 }
}
console.log(Count of missing element IDs: );
console.log(Array.from(missingIds));

