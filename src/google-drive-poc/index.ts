const DISCOVERY_DOC =
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const POC_FILE_NAME = 'in-browser-tools-poc-data.txt';

let tokenClient: google.accounts.oauth2.TokenClient;
let gapiInited = false;
let gisInited = false;
let fileId: string | null = null; // Store the ID of our POC file

function getRequiredElement<T extends HTMLElement>(
  id: string,
  type: new () => T,
): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(
      `Element with id '${id}' not found or is not of expected type.`,
    );
  }
  return element;
}

import { runWithUIState } from '../shared/ui-utils.js';

const clientIdInput = getRequiredElement('clientId', HTMLInputElement);
const authBtn = getRequiredElement('authBtn', HTMLButtonElement);
const signoutBtn = getRequiredElement('signoutBtn', HTMLButtonElement);
const dataInput = getRequiredElement('dataInput', HTMLTextAreaElement);
const saveBtn = getRequiredElement('saveBtn', HTMLButtonElement);
const loadBtn = getRequiredElement('loadBtn', HTMLButtonElement);
const statusDiv = getRequiredElement('status', HTMLDivElement);

function updateStatus(message: string, isError = false) {
  statusDiv.textContent = message;
  statusDiv.style.color = isError ? 'red' : 'green';
  console.log(isError ? 'Error:' : 'Status:', message);
}

// Ensure gapi is loaded globally
declare global {
  interface Window {
    gapiLoaded: () => void;
    gisLoaded: () => void;
  }
}

// Initialization callbacks need to be accessible globally if loaded via standard script tag
// Or we can poll for them since we use async defer.

function checkLibrariesLoaded() {
  if (typeof gapi !== 'undefined' && gapi.load && !gapiInited) {
    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        updateStatus('GAPI client loaded.');
      } catch (e: any) {
        updateStatus(`Error loading GAPI: ${e.message}`, true);
      }
    });
  }

  if (typeof google !== 'undefined' && google.accounts && !gisInited) {
    gisInited = true;
    updateStatus('Google Identity Services loaded.');
  }

  if (!gapiInited || !gisInited) {
    setTimeout(checkLibrariesLoaded, 100);
  }
}
checkLibrariesLoaded();

authBtn.addEventListener('click', async () => {
  const clientId = clientIdInput.value.trim();
  if (!clientId) {
    updateStatus('Please enter a Client ID first.', true);
    return;
  }

  if (!gapiInited || !gisInited) {
    updateStatus('Libraries are still loading, please wait.', true);
    return;
  }

  await runWithUIState(authBtn, statusDiv, 'Authorizing...', async () => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: '', // defined later
    });
    handleAuthClick(); // handleAuthClick will update status when done
  });
});

function handleAuthClick() {
  tokenClient.callback = async (resp: any) => {
    if (resp.error !== undefined) {
      updateStatus(`Auth error: ${resp.error}`, true);
      throw resp;
    }
    updateStatus('Authorized successfully.');
    authBtn.style.display = 'none';
    signoutBtn.style.display = 'inline-block';
    clientIdInput.disabled = true;
    saveBtn.disabled = false;
    loadBtn.disabled = false;
    await findPocFile();
  };

  if (gapi.client.getToken() === null) {
    // Prompt the user to select a Google Account and ask for consent to share their data
    // when establishing a new session.
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    // Skip display of account chooser and consent dialog for an existing session.
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

signoutBtn.addEventListener('click', () => {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      gapi.client.setToken(null);
      updateStatus('Signed out.');
      authBtn.style.display = 'inline-block';
      signoutBtn.style.display = 'none';
      clientIdInput.disabled = false;
      saveBtn.disabled = true;
      loadBtn.disabled = true;
      fileId = null;
      dataInput.value = '';
    });
  }
});

async function findPocFile() {
  updateStatus('Searching for existing POC file...');
  try {
    const response = await gapi.client.drive.files.list({
      q: `name='${POC_FILE_NAME}' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
    });
    const files = response.result.files;
    if (files && files.length > 0) {
      fileId = files[0].id!;
      updateStatus(
        `Found existing file (ID: ${fileId}). Ready to load or overwrite.`,
      );
    } else {
      fileId = null;
      updateStatus('No existing file found. Ready to save a new one.');
    }
  } catch (err: any) {
    updateStatus(`Error finding file: ${err.message}`, true);
  }
}

saveBtn.addEventListener('click', async () => {
  const content = dataInput.value;
  let successMessage = '';
  await runWithUIState(
    saveBtn,
    statusDiv,
    'Saving to Google Drive...',
    async () => {
      const fileMetadata = {
        name: POC_FILE_NAME,
        mimeType: 'text/plain',
      };

      const file = new Blob([content], { type: 'text/plain' });
      const metadata = new Blob([JSON.stringify(fileMetadata)], {
        type: 'application/json',
      });

      const form = new FormData();
      form.append('metadata', metadata);
      form.append('file', file);

      const token = gapi.client.getToken()?.access_token;
      if (!token) throw new Error('No access token available.');

      let url =
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      let method = 'POST';

      // If file exists, update it instead of creating a new one
      if (fileId) {
        url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
        method = 'PATCH';
      }

      const res = await fetch(url, {
        method: method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || 'Failed to save file');
      }

      const data = await res.json();
      fileId = data.id;
      successMessage = `File saved successfully! (ID: ${fileId})`;
    },
    undefined,
  );

  if (successMessage && !statusDiv.textContent?.startsWith('Error')) {
    updateStatus(successMessage);
  }
});

loadBtn.addEventListener('click', async () => {
  if (!fileId) {
    updateStatus('No file found to load. Save one first!', true);
    return;
  }

  await runWithUIState(
    loadBtn,
    statusDiv,
    'Loading from Google Drive...',
    async () => {
      const token = gapi.client.getToken()?.access_token;
      if (!token) throw new Error('No access token available.');

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      dataInput.value = text;
    },
    'File loaded successfully!',
  );
});
