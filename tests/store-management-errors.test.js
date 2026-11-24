const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'store-management', 'store-management.js'), 'utf8');
const end = source.indexOf('async function refresh()');
assert(end > 0);

(async () => {
  const context = {
    location: { hostname: 'shelldesignz.com' },
    document: {},
    console: { error() {} },
    fetch: async () => { throw new TypeError('Failed to fetch'); },
  };
  vm.runInNewContext(`${source.slice(0, end)}\nglobalThis.testRequest = request;`, context);
  await assert.rejects(context.testRequest('stores'), /Could not reach the store API.*Cloudflare Access/);
  context.fetch = async () => ({
    ok: false,
    status: 403,
    headers: { get: () => 'application/json' },
    json: async () => ({ error: 'Access denied.' }),
  });
  await assert.rejects(context.testRequest('stores'), /Access denied/);
  context.fetch = async () => ({ headers: { get: () => 'text/html' } });
  await assert.rejects(context.testRequest('stores'), /returned a page instead of data/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'store-management', 'index.html'), 'utf8');
  assert.match(html, /id="stores-status"[^>]*>Loading stores/);
  console.log('Store management error handling tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
