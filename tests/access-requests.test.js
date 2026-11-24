const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor() {
    this.children = [];
    this.listeners = {};
    this.value = '';
    this.disabled = false;
    this.textContent = '';
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(event, callback) { this.listeners[event] = callback; }
  remove() { this.removed = true; }
  reset() { this.resetCalled = true; }
  querySelector() { return this.button; }
}

const root = path.join(__dirname, '..');
const source = (directory, file) => fs.readFileSync(path.join(root, directory, file), 'utf8');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const guide = source('mynutrition-guide', 'index.html');
assert.match(home, /href="\/mynutrition-guide\/#request-access">Request MyNutrition Access/);
assert.match(guide, /id="access-request-form"/);
assert.match(guide, /src="\/mynutrition-guide\/access-request\.js\?v=1"/);

(async () => {
  const form = new Element();
  form.button = new Element();
  const input = new Element();
  input.value = ' person@example.com ';
  const status = new Element();
  const elements = { 'access-request-form': form, 'request-email': input, 'request-status': status };
  let submitted;
  const context = {
    location: { hostname: 'example.com' },
    document: { getElementById: (id) => elements[id] },
    console: { error() {} },
    fetch: async (url, options) => {
      submitted = { url, body: JSON.parse(options.body) };
      return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ success: true }) };
    },
  };
  vm.runInNewContext(source('mynutrition-guide', 'access-request.js'), context);
  await form.listeners.submit({ preventDefault() {} });
  assert.equal(submitted.url, '/api/data/access-requests');
  assert.equal(submitted.body.email, 'person@example.com');
  assert.match(status.textContent, /contact you by email/);
  assert.equal(form.resetCalled, true);
  context.fetch = async () => { throw new Error('offline'); };
  await form.listeners.submit({ preventDefault() {} });
  assert.match(status.textContent, /offline/);
  assert.equal(form.button.disabled, false);

  const list = new Element();
  const requestStatus = new Element();
  const refresh = new Element();
  const adminElements = {
    'access-requests': list, 'access-requests-status': requestStatus, 'refresh-access-requests': refresh,
  };
  const calls = [];
  const adminContext = {
    document: { getElementById: (id) => adminElements[id], createElement: () => new Element() },
    confirm: () => true,
    request: async (route, body) => {
      calls.push({ route, body });
      return route === 'access-requests' ? { requests: ['person@example.com'] } : { success: true };
    },
  };
  vm.runInNewContext(source('store-management', 'access-requests.js'), adminContext);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(list.children[0].children[0].textContent, 'person@example.com');
  await list.children[0].children[1].listeners.click();
  assert.equal(calls[1].route, 'access-requests/remove');
  assert.equal(calls[1].body.email, 'person@example.com');
  assert.equal(list.children[0].removed, true);
  console.log('Access request form and management tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
