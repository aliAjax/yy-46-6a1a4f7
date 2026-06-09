const fs = require('node:fs');

const checks = [
  {
    file: 'index.html',
    test: content => /<!doctype html>/i.test(content),
    message: 'index.html should declare a doctype'
  },
  {
    file: 'index.html',
    test: content => /<script\s+src="js\/data\.js"><\/script>/.test(content),
    message: 'index.html should load js/data.js'
  },
  {
    file: 'index.html',
    test: content => /<script\s+src="js\/app\.js"><\/script>/.test(content),
    message: 'index.html should load js/app.js'
  },
  {
    file: 'css/style.css',
    test: content => content.includes('#app') && content.includes('.hidden'),
    message: 'css/style.css should contain the base app selectors'
  }
];

let failed = false;

for (const check of checks) {
  const content = fs.readFileSync(check.file, 'utf8');
  if (!check.test(content)) {
    console.error(`lint failed: ${check.message}`);
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
}
