const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const shopHtml = fs.readFileSync(path.join(root, 'shop', 'index.html'), 'utf8');
assert.match(shopHtml, /<option value="amazon">/);
assert.doesNotMatch(shopHtml, /<option value="walmart"/);
assert.doesNotMatch(shopHtml, /addIngredientForm|newIngredient|Add an ingredient/i);
const recipeSource = fs.readFileSync(path.join(root, 'Christmas', 'christmas.js'), 'utf8');
const start = recipeSource.indexOf('function shopRecipe(');
const end = recipeSource.indexOf('function addCategory()', start);
assert(start >= 0 && end > start, 'Recipe shop handler is missing');

function openShop(recipe, options = {}) {
  const storage = new Map();
  const messages = [];
  const tabs = [];
  const context = {
    storeDrinks: () => [recipe],
    setStatus: (...args) => messages.push(args),
    console: { error() {} },
    sessionStorage: {
      setItem(key, value) {
        if (options.storageError) throw new Error('Storage disabled');
        storage.set(key, value);
      },
      removeItem: (key) => storage.delete(key),
    },
    window: {
      open(url) {
        if (options.blocked) return null;
        const tab = { url, payload: JSON.parse(storage.get('recipe-shopping-list')), opener: true };
        tabs.push(tab);
        return tab;
      },
    },
  };
  vm.runInNewContext(`${recipeSource.slice(start, end)}\nshopRecipe(7);`, context);
  return { storage, messages, tabs };
}

const recipe = {
  id: 7,
  name: 'Private recipe name',
  ingredients: [
    { name: 'Flour', side: 'TOP' },
    { name: 'Sugar', side: 'top' },
    { name: 'Private instruction', side: 'BOTTOM' },
    { name: ' ', side: 'TOP' },
  ],
};
const opened = openShop(recipe);
assert.equal(opened.tabs[0].url, '/shop/');
assert.deepEqual(JSON.parse(JSON.stringify(opened.tabs[0].payload)), { version: 1, items: ['Flour', 'Sugar'] });
assert.equal(opened.tabs[0].opener, null);
assert.equal(opened.storage.size, 0);
const blocked = openShop(recipe, { blocked: true });
assert.match(blocked.messages[0][0], /blocked/);
assert.equal(blocked.storage.size, 0);
const unavailable = openShop(recipe, { storageError: true });
assert.match(unavailable.messages[0][0], /Storage disabled/);
assert.equal(unavailable.tabs.length, 0);

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
    this.value = '';
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }
  appendChild(node) { this.append(node); }
  addEventListener(type, callback) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(callback);
  }
  trigger(type) { for (const callback of this.listeners[type] || []) callback({ target: this }); }
  setAttribute(name, value) { this.attributes[name] = value; }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.tag === selector) return child;
      const match = child.querySelector(selector);
      if (match) return match;
    }
    return null;
  }
  querySelectorAll(selector) { return selector === '.shopping-item' ? this.children : []; }
}

function loadShop(raw) {
  const elements = {
    shoppingList: new Element('div'),
    status: new Element('p'),
    retailer: new Element('select'),
  };
  elements.retailer.value = 'walmart';
  const storage = new Map();
  const listeners = {};
  if (raw !== null) storage.set('recipe-shopping-list', raw);
  const context = {
    URL,
    console: { error() {} },
    document: {
      getElementById: (id) => elements[id],
      createElement: (tag) => new Element(tag),
      addEventListener: (type, callback) => { listeners[type] = callback; },
    },
    sessionStorage: { getItem: (key) => storage.has(key) ? storage.get(key) : null, removeItem: (key) => storage.delete(key) },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'shop', 'shop.js'), 'utf8'), context);
  return { elements, storage, listeners };
}

const { elements, storage, listeners } = loadShop(JSON.stringify({ version: 1, items: ['Milk & sugar', 'Flour'] }));
assert.equal(storage.size, 0);
assert.equal(elements.shoppingList.children.length, 2);
const row = elements.shoppingList.children[0];
assert.equal(new URL(row.querySelector('a').href).searchParams.get('q'), 'Milk & sugar');
elements.retailer.value = 'amazon';
elements.retailer.trigger('change');
assert.match(row.children[1].textContent, /Checking/);
listeners['shop-products-loaded']({ detail: [
  { name: 'Flour', value: 'https://www.amazon.com/dp/B07Z78Q8TB?tag=example-20', category: 'ingredient' },
  { name: 'Milk & sugar', value: 'https://www.amazon.com/dp/B000000001', category: 'supply' },
] });
assert.equal(row.querySelector('a'), null);
const flour = elements.shoppingList.children[1].querySelector('a');
assert.equal(new URL(flour.href).pathname, '/dp/B07Z78Q8TB');
assert.equal(new URL(flour.href).searchParams.get('tag'), 'example-20');
assert.equal(flour.rel, 'sponsored noopener');
listeners['shop-products-loaded']({ detail: [
  { name: 'Flour', value: 'https://amazon.com/dp/B000000001', category: 'ingredient' },
  { name: 'flour', value: 'https://amazon.com/dp/B000000002', category: 'ingredient' },
] });
assert.equal(elements.shoppingList.children[1].querySelector('a'), null);
assert.match(elements.shoppingList.children[1].children[1].textContent, /Multiple matches/);
listeners['shop-products-error']();
assert.match(elements.shoppingList.children[1].children[1].textContent, /unavailable/);
const matching = loadShop(JSON.stringify({ version: 1, items: [
  '2 cups semi-sweet chocolate chips', '1 chocolate chip', '2 tsp vanilla extract',
  '1 cup brown sugar', 'vanilla', 'sugarcane',
] }));
matching.elements.retailer.value = 'amazon';
matching.listeners['shop-products-loaded']({ detail: [
  { name: 'Chocolate Chips', value: 'https://amazon.com/dp/B00932F6BO', category: 'ingredient' },
  { name: 'Vanilla Extract', value: 'https://amazon.com/dp/B08CYCRF2W', category: 'ingredient' },
  { name: 'Vanilla Coffee Creamer', value: 'https://amazon.com/dp/B0H6C95CSY', category: 'ingredient' },
  { name: 'Sugar', value: 'https://amazon.com/dp/B07FTX5JC4', category: 'ingredient' },
  { name: 'Brown Sugar', value: 'https://amazon.com/dp/B0D1LC2WRY', category: 'ingredient' },
] });
const rows = matching.elements.shoppingList.children;
['/dp/B00932F6BO', '/dp/B00932F6BO', '/dp/B08CYCRF2W', '/dp/B0D1LC2WRY']
  .forEach((expected, index) => assert.equal(new URL(rows[index].querySelector('a').href).pathname, expected));
assert.equal(rows[4].querySelector('a'), null);
assert.equal(rows[5].querySelector('a'), null);
for (const raw of [null, '{invalid', JSON.stringify({ version: 1, items: [] })]) {
  const result = loadShop(raw);
  assert.match(result.elements.status.textContent, /browse the product picks/i);
  assert.doesNotMatch(result.elements.status.textContent, /add an ingredient/i);
}
assert.match(loadShop('{invalid').elements.status.textContent, /Could not load/);
assert.match(loadShop(null).elements.status.textContent, /No recipe ingredients/);
assert.match(loadShop(JSON.stringify({ version: 1, items: [] })).elements.status.textContent, /No TOP ingredients/);
console.log('Shop handoff and retailer link tests passed.');
