const $ = (id) => document.getElementById(id);
const apiBase = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  ? 'http://127.0.0.1:8787'
  : '';
let busy = false;

function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}

async function request(path, body) {
  const options = body === undefined ? { cache: 'no-store' } : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
  const response = await fetch(`${apiBase}/api/store-management/${path}`, options);
  if (!(response.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
    throw new Error('The store API returned a page instead of data. Check that the Worker is running and that you are signed in when using the live site.');
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}

async function refresh() {
  const { stores } = await request('stores');
  $('stores').replaceChildren();
  if (!stores.length) {
    const item = document.createElement('li');
    item.textContent = 'No MyNutrition stores found.';
    $('stores').appendChild(item);
  }
  for (const store of stores) {
    const item = document.createElement('li');
    const owners = store.members.filter((member) => member.owner).map((member) => member.email);
    const others = store.members.filter((member) => !member.owner).map((member) => member.email);
    const details = document.createElement('span');
    details.textContent = `${store.name} (${store.id}) — Owner: ${owners.join(', ') || 'unknown'}; Other access: ${others.join(', ') || 'none'}`;
    const visibility = document.createElement('button');
    visibility.type = 'button';
    visibility.className = 'visibility-button';
    visibility.textContent = store.publicSlideshow ? 'Remove from public slideshow' : 'Add to public slideshow';
    visibility.addEventListener('click', async () => {
      if (busy) return;
      const enabled = !store.publicSlideshow;
      const prompt = enabled
        ? `Make "${store.name}" visible in the public slideshow? Its store name, flavors, categories and drink names will be public.`
        : `Remove "${store.name}" from the public slideshow?`;
      if (!window.confirm(prompt)) return;
      busy = true;
      visibility.disabled = true;
      try {
        await request('public-slideshow', { storeId: store.id, enabled });
        store.publicSlideshow = enabled;
        visibility.textContent = enabled ? 'Remove from public slideshow' : 'Add to public slideshow';
        status(`"${store.name}" ${enabled ? 'added to' : 'removed from'} the public slideshow. Changes can take time to appear.`);
      } catch (error) { status(error.message, true); }
      finally { busy = false; visibility.disabled = false; }
    });
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Delete';
    button.addEventListener('click', async () => {
      if (busy) return;
      if (!window.confirm(`Permanently delete "${store.name}" (${store.id}) and remove access for its members?\n\nThere is no automatic backup. This cannot be undone.`)) return;
      busy = true;
      button.disabled = true;
      try {
        await request('delete', { storeId: store.id });
        const message = `Deleted "${store.name}" (${store.id}).`;
        status(message);
        try { await refresh(); } catch (error) { status(`${message}\nCould not refresh: ${error.message}`, true); }
      } catch (error) { status(error.message, true); }
      finally { busy = false; button.disabled = false; }
    });
    item.appendChild(details);
    item.appendChild(visibility);
    item.appendChild(button);
    $('stores').appendChild(item);
  }
}

$('refresh').addEventListener('click', async () => {
  try { await refresh(); status('Store list refreshed.'); }
  catch (error) { status(error.message, true); }
});

$('add-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  const name = $('name').value.trim();
  const owner = $('owner').value.trim();
  if (!window.confirm(`Add "${name}" for ${owner}?`)) return;
  busy = true;
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    const result = await request('create', { name, owner });
    const message = `Created "${name}" for ${owner}. Store number: ${result.storeId}`;
    status(message);
    event.currentTarget.reset();
    try { await refresh(); } catch (error) { status(`${message}\nCould not refresh: ${error.message}`, true); }
  } catch (error) { status(error.message, true); }
  finally { busy = false; button.disabled = false; }
});

refresh().catch((error) => status(error.message, true));
