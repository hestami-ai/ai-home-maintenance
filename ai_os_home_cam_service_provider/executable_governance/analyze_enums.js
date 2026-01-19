const data = JSON.parse(require('fs').readFileSync('stringly_violations.json', 'utf8').split('\n').slice(1).join('\n'));
const enumCounts = {};
for (const v of data.violations) {
  if (v.reason.includes('Log message')) continue;
  if (v.reason.includes('Type discriminator')) continue;
  // Find the part after 'matches Prisma enum' and before the next sentence
  const idx = v.reason.indexOf('matches Prisma enum');
  if (idx >= 0) {
    const rest = v.reason.slice(idx + 19);
    const endIdx = rest.indexOf('.');
    const enumPart = endIdx > 0 ? rest.slice(0, endIdx) : rest;
    const cleanPart = enumPart.replace(/`/g, '').trim();
    const enums = cleanPart.split(' or ');
    for (const e of enums) {
      const trimmed = e.trim();
      if (trimmed) enumCounts[trimmed] = (enumCounts[trimmed] || 0) + 1;
    }
  }
}
console.log('Most commonly used enums:');
Object.entries(enumCounts).sort((a,b) => b[1] - a[1]).slice(0, 50).forEach(([e, c]) => console.log(c + ' ' + e));
