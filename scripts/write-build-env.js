const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const buildDate = new Date().toISOString();
const version = pkg.version || '1.0.0';

const content = `# Generated at build time - do not edit
NEXT_PUBLIC_BUILD_VERSION=${version}
NEXT_PUBLIC_BUILD_DATE=${buildDate}
`;

const outPath = path.join(__dirname, '..', '.env.production.local');
fs.writeFileSync(outPath, content, 'utf8');
console.log(`Build info: v${version} ${buildDate}`);
