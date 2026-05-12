import React, { useEffect, useState } from 'react';
import { LLMCore } from '../llm-core.js';

export const LlmSettings: React.FC<{ core: LLMCore }> = ({ core }) => {
  const [model, setModel] = useState<string>('');

  useEffect(() => {
    setModel(core.model || 'Not configured');
  }, [core]);

  return (
    <div
      style={{
        padding: '15px',
        background: '#eef5fb',
        border: '1px solid #b3d4fc',
        borderRadius: '4px',
        marginBottom: '20px',
      }}
    >
      <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
        <strong>Current Model:</strong>{' '}
        <span id="shared-model-display">{model}</span>
      </p>
      <p style={{ margin: 0, fontSize: '14px' }}>
        <a
          href="./settings.html"
          style={{ color: '#0066cc', textDecoration: 'none' }}
        >
          ⚙️ Configure OpenRouter API Key and Models in Settings
        </a>
      </p>
    </div>
  );
};
