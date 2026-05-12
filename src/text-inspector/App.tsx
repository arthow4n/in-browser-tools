import React, { useState } from 'react';
import { PageLayout, Panel, TextArea } from '../shared/components/index.js';

export const App: React.FC = () => {
  const [text, setText] = useState('');

  const chars = Array.from(text);

  return (
    <PageLayout>
      <Panel title="Text Inspector">
        <TextArea
          label="Enter text to inspect:"
          id="input-text"
          placeholder="Type or paste text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
        />

        <div className="output-group" style={{ marginTop: '20px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Inspected Text:</label>
          <div id="output-text" style={{
            width: '100%',
            minHeight: '150px',
            padding: '15px',
            border: '1px solid #ccc',
            backgroundColor: '#f9f9f9',
            fontFamily: "Consolas, 'Courier New', monospace",
            borderRadius: '4px',
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'flex-start',
            gap: '5px'
          }}>
            {chars.map((char, index) => {
              const codePoint = char.codePointAt(0);
              const hexCode = codePoint ? `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}` : '';

              let displayChar = char;
              let isWhitespace = false;

              if (char === ' ') {
                displayChar = '·';
                isWhitespace = true;
              } else if (char === '\n') {
                displayChar = '↵';
                isWhitespace = true;
              } else if (char === '\t') {
                displayChar = '⇥';
                isWhitespace = true;
              } else if (char === '\r') {
                displayChar = '␍';
                isWhitespace = true;
              }

              return (
                <div key={index} className={`char-box ${isWhitespace ? 'whitespace' : ''}`} style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  border: '1px solid #ccc',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  background: isWhitespace ? '#e0e0e0' : '#fff',
                  color: isWhitespace ? '#555' : 'inherit',
                  minWidth: '3em'
                }}>
                  <span className="char-val" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{displayChar}</span>
                  <span className="char-code" style={{ fontSize: '0.7em', color: '#888' }}>{hexCode}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </PageLayout>
  );
};
