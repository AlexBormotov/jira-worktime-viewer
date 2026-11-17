const fs = require('fs');
const s = fs.readFileSync('bookmarklet-by-day-and-task.js', 'utf8');
const marker = "a.href = 'javascript:";
const codeStart = s.indexOf(marker) + marker.length;
const end = s.indexOf("';", codeStart);
const code = s.slice(codeStart, end);
const needles = ['Math.floor(totalSec', 'filterBar', 'visibleEntries', 'taskResults', 'buildDetailTable', '0h'];
for (const n of needles) {
  const i = code.indexOf(n);
  console.log('\n==', n, i);
  if (i >= 0) console.log(code.slice(Math.max(0, i - 80), i + 120));
}
fs.writeFileSync('_bookmarklet-check.js', code);
