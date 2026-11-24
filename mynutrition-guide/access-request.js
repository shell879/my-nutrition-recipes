const accessRequestForm = document.getElementById('access-request-form');
const accessRequestStatus = document.getElementById('request-status');
const accessRequestButton = accessRequestForm.querySelector('button');
const accessRequestApiBase = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  ? 'http://127.0.0.1:8787' : '';

accessRequestButton.disabled = false;
accessRequestStatus.textContent = '';
accessRequestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (accessRequestButton.disabled) return;
  accessRequestButton.disabled = true;
  accessRequestStatus.textContent = 'Sending request...';
  try {
    const response = await fetch(`${accessRequestApiBase}/api/data/access-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: document.getElementById('request-email').value.trim() }),
    });
    if (!(response.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
      throw new Error('The request service returned an unexpected response.');
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    if (result.success !== true) throw new Error('The request service did not confirm your request.');
    accessRequestForm.reset();
    accessRequestStatus.textContent = 'Your request was received. I will contact you by email.';
  } catch (error) {
    console.error('Could not send access request:', error);
    accessRequestStatus.textContent = `Could not send your request: ${error.message}`;
  } finally {
    accessRequestButton.disabled = false;
  }
});
