import React, { useState, useEffect } from 'react';
import { PageLayout, Panel, Button, TextArea, Input } from '../shared/components/index.js';
import { useAsyncAction } from '../shared/hooks/useAsyncAction.js';

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const POC_FILE_NAME = 'in-browser-tools-poc-data.txt';

export const App: React.FC = () => {
  const [clientId, setClientId] = useState('');
  const [dataContent, setDataContent] = useState('');
  const [fileId, setFileId] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [tokenClient, setTokenClient] = useState<any>(null);

  const { isLoading, statusText, isError, runAction } = useAsyncAction();
  const [customStatus, setCustomStatus] = useState<string>('');

  useEffect(() => {
    let checkInterval: number;
    const checkLibraries = () => {
      if (typeof gapi !== 'undefined' && gapi.load && !gapiLoaded) {
        gapi.load('client', async () => {
          try {
            await gapi.client.init({
              discoveryDocs: [DISCOVERY_DOC],
            });
            setGapiLoaded(true);
            setCustomStatus('GAPI client loaded.');
          } catch (e: any) {
            setCustomStatus(`Error loading GAPI: ${e.message}`);
          }
        });
      }

      if (typeof google !== 'undefined' && google.accounts && !gisLoaded) {
        setGisLoaded(true);
        setCustomStatus('Google Identity Services loaded.');
      }

      if (gapiLoaded && gisLoaded) {
        clearInterval(checkInterval);
      }
    };

    checkInterval = window.setInterval(checkLibraries, 100);
    return () => clearInterval(checkInterval);
  }, [gapiLoaded, gisLoaded]);

  const findPocFile = async () => {
    setCustomStatus('Searching for existing POC file...');
    try {
      const response = await gapi.client.drive.files.list({
        q: `name='${POC_FILE_NAME}' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });
      const files = response.result.files;
      if (files && files.length > 0) {
        setFileId(files[0].id!);
        setCustomStatus(`Found existing file (ID: ${files[0].id}). Ready to load or overwrite.`);
      } else {
        setFileId(null);
        setCustomStatus('No existing file found. Ready to save a new one.');
      }
    } catch (err: any) {
      setCustomStatus(`Error finding file: ${err.message}`);
    }
  };

  const handleAuth = async () => {
    if (!clientId.trim()) {
      alert('Please enter a Client ID first.');
      return;
    }

    if (!gapiLoaded || !gisLoaded) {
      alert('Libraries are still loading, please wait.');
      return;
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: async (resp: any) => {
        if (resp.error !== undefined) {
          setCustomStatus(`Auth error: ${resp.error}`);
          return;
        }
        setCustomStatus('Authorized successfully.');
        setIsAuthorized(true);
        await findPocFile();
      },
    });

    setTokenClient(client);

    // @ts-ignore
    if (gapi.client.getToken() === null) {
      client.requestAccessToken({ prompt: 'consent' });
    } else {
      client.requestAccessToken({ prompt: '' });
    }
  };

  const handleSignOut = () => {
    // @ts-ignore
    const token = gapi.client.getToken();
    if (token !== null) {
      // @ts-ignore
      google.accounts.oauth2.revoke(token.access_token, () => {
        // @ts-ignore
        gapi.client.setToken(null);
        setCustomStatus('Signed out.');
        setIsAuthorized(false);
        setFileId(null);
        setDataContent('');
      });
    }
  };

  const handleSave = async () => {
    await runAction('Saving to Google Drive...', async () => {
      const fileMetadata = { name: POC_FILE_NAME, mimeType: 'text/plain' };
      const fileBlob = new Blob([dataContent], { type: 'text/plain' });
      const metadataBlob = new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' });

      const form = new FormData();
      form.append('metadata', metadataBlob);
      form.append('file', fileBlob);

      // @ts-ignore
      const token = gapi.client.getToken()?.access_token;
      if (!token) throw new Error('No access token available.');

      let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      let method = 'POST';

      if (fileId) {
        url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
        method = 'PATCH';
      }

      const res = await fetch(url, {
        method: method,
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || 'Failed to save file');
      }

      const data = await res.json();
      setFileId(data.id);
      return `File saved successfully! (ID: ${data.id})`;
    });
  };

  const handleLoad = async () => {
    if (!fileId) {
      alert('No file found to load. Save one first!');
      return;
    }

    await runAction('Loading from Google Drive...', async () => {
      // @ts-ignore
      const token = gapi.client.getToken()?.access_token;
      if (!token) throw new Error('No access token available.');

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      setDataContent(text);
      return 'File loaded successfully!';
    });
  };

  return (
    <PageLayout>
      <Panel title="Google Drive Save/Load POC">
        <div className="instructions" style={{ marginBottom: '20px' }}>
          <h3>Setup Instructions</h3>
          <p>To use this POC, you need to configure a Google Cloud Project:</p>
          <ol>
            <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud Console</a>.</li>
            <li>Create a new project or select an existing one.</li>
            <li>Enable the <strong>Google Drive API</strong> in "APIs & Services" &gt; "Library".</li>
            <li>Go to "APIs & Services" &gt; "Credentials".</li>
            <li>Click "Create Credentials" &gt; "OAuth client ID".</li>
            <li>Choose "Web application" as the Application type.</li>
            <li>Under "Authorized JavaScript origins", add the URL of this page (e.g., <code>http://localhost:3000</code>).</li>
            <li>Click "Create" and copy your <strong>Client ID</strong>.</li>
          </ol>
        </div>

        <div className="setup-input" style={{ marginBottom: '20px' }}>
          <Input
            label="Enter your Client ID:"
            type="text"
            placeholder="YOUR_CLIENT_ID.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={isAuthorized}
            id="clientId"
          />
          {!isAuthorized ? (
            <Button onClick={handleAuth} id="authBtn">Authorize / Initialize</Button>
          ) : (
            <Button onClick={handleSignOut} id="signoutBtn" variant="secondary">Sign Out</Button>
          )}
        </div>

        <div>
          <h3>Data to Save/Load</h3>
          <TextArea
            id="dataInput"
            placeholder="Enter text here..."
            value={dataContent}
            onChange={(e) => setDataContent(e.target.value)}
            rows={5}
          />
          <div className="action-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
            <Button onClick={handleSave} disabled={!isAuthorized || isLoading} id="saveBtn">Save to Drive</Button>
            <Button onClick={handleLoad} disabled={!isAuthorized || !fileId || isLoading} id="loadBtn">Load from Drive</Button>
          </div>
        </div>

        <div id="status" style={{ marginTop: '15px', fontWeight: 'bold', wordWrap: 'break-word', color: isError ? 'red' : 'green' }}>
          {statusText || customStatus}
        </div>
      </Panel>
    </PageLayout>
  );
};
