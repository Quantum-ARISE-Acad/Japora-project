// Check names only; never print the contents of a potentially sensitive file.
const { execFileSync } = require('node:child_process');
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const unsafe = files.filter((file) => {
  const name = file.split('/').at(-1);
  const envFile = /^\.env(?:\.|$)/.test(name) && !name.endsWith('.example');
  return envFile || /\.(?:db(?:-.*)?|sqlite\d*(?:-.*)?|pem|key|p12|pfx|dump)$/i.test(name)
    || /^id_(?:rsa|ed25519|ecdsa)$/.test(name);
});
if (unsafe.length) {
  console.error('Sensitive files must not be tracked:\n' + unsafe.join('\n'));
  process.exitCode = 1;
} else {
  console.log('No tracked environment secrets, database files or private key files found.');
}
