import React, { useState, useEffect } from 'react';
import { PageLayout, Panel, Input } from '../shared/components/index.js';

export const App: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');

  const [encodedCredentials, setEncodedCredentials] = useState('');
  const [fullUrl, setFullUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  useEffect(() => {
    const encodedUser = encodeURIComponent(username);
    const encodedPass = encodeURIComponent(password);

    if (username === '' && password === '') {
      setEncodedCredentials('');
    } else {
      setEncodedCredentials(`${encodedUser}:${encodedPass}`);
    }

    setUrlError('');
    setFullUrl('');

    if (url) {
      try {
        const parsedUrl = new URL(url);
        if (username !== '' || password !== '') {
          parsedUrl.username = username;
          parsedUrl.password = password;
        }
        setFullUrl(parsedUrl.href);
      } catch (e) {
        setUrlError('Invalid URL format');
      }
    }
  }, [username, password, url]);

  return (
    <PageLayout>
      <Panel title="Basic Auth Generator">
        <Input
          label="Username:"
          type="text"
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          label="Password:"
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="URL (Optional):"
          type="text"
          placeholder="https://example.com/api"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {urlError && (
          <span
            className="error-text"
            style={{ color: 'red', fontSize: '0.9em' }}
          >
            {urlError}
          </span>
        )}

        <div
          className="output-group"
          style={{
            marginTop: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <label style={{ fontWeight: 'bold' }}>Encoded Credentials:</label>
          <div
            className="output-field"
            style={{
              width: '100%',
              padding: '15px',
              border: '1px solid #ccc',
              backgroundColor: '#f9f9f9',
              fontFamily: "Consolas, 'Courier New', monospace",
              borderRadius: '4px',
              wordBreak: 'break-all',
            }}
          >
            {encodedCredentials}
          </div>

          <label style={{ fontWeight: 'bold', marginTop: '10px' }}>
            Full URL with Basic Auth:
          </label>
          <div
            className="output-field"
            style={{
              width: '100%',
              padding: '15px',
              border: '1px solid #ccc',
              backgroundColor: '#f9f9f9',
              fontFamily: "Consolas, 'Courier New', monospace",
              borderRadius: '4px',
              wordBreak: 'break-all',
            }}
          >
            {fullUrl}
          </div>
        </div>
      </Panel>
    </PageLayout>
  );
};
