function initStoreSharing({ apiBase, getSourceMode, setStatus }) {
  const button = document.getElementById('shareStoreButton');
  const dialog = document.getElementById('shareStoreDialog');
  const number = document.getElementById('shareStoreNumber');
  let generation = 0;

  function hide() {
    generation += 1;
    button.hidden = true;
    if (dialog.open) dialog.close();
    number.value = '';
  }

  function beginUpdate() {
    hide();
    return generation;
  }

  function update(stores, updateGeneration) {
    if (updateGeneration !== generation || getSourceMode() !== 'api') return;
    const activeStore = stores.find((store) => store.active === true);
    if (!activeStore || typeof activeStore.owned !== 'boolean') {
      throw new Error('The active store ownership could not be determined. Update the data API.');
    }
    button.hidden = !activeStore.owned;
  }

  button.addEventListener('click', async () => {
    if (getSourceMode() !== 'api') {
      setStatus('Switch to API mode to share a store number. Local drafts cannot be shared.', true);
      return;
    }

    const requestGeneration = generation;
    button.disabled = true;
    try {
      const response = await fetch(`${apiBase}/api/my-stores`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Store list request failed (HTTP ${response.status}).`);
      }

      const data = await response.json();
      if (requestGeneration !== generation) return;
      if (!Array.isArray(data.stores)) {
        throw new Error('The store list response has an invalid format.');
      }
      const activeStore = data.stores.find((store) => store.active === true);
      if (!activeStore || !Number.isSafeInteger(activeStore.storeId) || activeStore.storeId <= 0) {
        throw new Error('No valid active store number was returned.');
      }
      if (activeStore.owned !== true || getSourceMode() !== 'api' || button.hidden) {
        hide();
        setStatus('Only the owner can share this store number.', true);
        return;
      }

      number.value = String(activeStore.storeId);
      dialog.showModal();
      number.select();
    } catch (error) {
      if (requestGeneration !== generation) return;
      console.error('Failed to retrieve the active store number:', error);
      setStatus(`Could not retrieve the store number: ${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  });

  return { hide, beginUpdate, update };
}
