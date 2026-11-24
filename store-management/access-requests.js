const accessRequestsList = document.getElementById('access-requests');
const accessRequestsStatus = document.getElementById('access-requests-status');
const refreshAccessRequestsButton = document.getElementById('refresh-access-requests');
let accessRequestsBusy = false;

async function loadAccessRequests() {
  if (accessRequestsBusy) return;
  accessRequestsBusy = true;
  refreshAccessRequestsButton.disabled = true;
  try {
    const result = await request('access-requests');
    if (!Array.isArray(result.requests) || result.requests.some((email) => typeof email !== 'string')) {
      throw new Error('The access request list is invalid.');
    }
    const items = result.requests.map((email) => {
      const item = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = email;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove request';
      remove.addEventListener('click', async () => {
        if (accessRequestsBusy || !confirm(`Remove the request for ${email}?`)) return;
        accessRequestsBusy = true;
        remove.disabled = true;
        refreshAccessRequestsButton.disabled = true;
        try {
          await request('access-requests/remove', { email });
          item.remove();
          accessRequestsStatus.textContent = 'Request removed. KV changes can take time to appear.';
        } catch (error) {
          accessRequestsStatus.textContent = `Could not remove request: ${error.message}`;
        } finally {
          accessRequestsBusy = false;
          remove.disabled = false;
          refreshAccessRequestsButton.disabled = false;
        }
      });
      item.append(text, remove);
      return item;
    });
    accessRequestsList.replaceChildren(...items);
    accessRequestsStatus.textContent = items.length ? 'Contact requesters by email.' : 'No access requests.';
  } catch (error) {
    accessRequestsStatus.textContent = `Could not load access requests: ${error.message}`;
  } finally {
    accessRequestsBusy = false;
    refreshAccessRequestsButton.disabled = false;
  }
}

refreshAccessRequestsButton.addEventListener('click', loadAccessRequests);
loadAccessRequests();
