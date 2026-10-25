const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'www');

fs.mkdirSync(output, { recursive: true });
for (const file of ['index.html', 'icon.jpg', 'privacypolicy.html']) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}

fs.copyFileSync(
  path.join(root, 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js'),
  path.join(output, 'capacitor.js'),
);
fs.copyFileSync(
  path.join(root, 'node_modules', '@capgo', 'capacitor-health', 'dist', 'plugin.js'),
  path.join(output, 'health.js'),
);
fs.copyFileSync(
  path.join(root, 'node_modules', '@capacitor', 'local-notifications', 'dist', 'plugin.js'),
  path.join(output, 'local-notifications.js'),
);

console.log('Copied web assets and Capacitor plugin runtimes into www/');
