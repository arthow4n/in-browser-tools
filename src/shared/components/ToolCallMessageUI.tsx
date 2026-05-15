import React from 'react';

interface ToolCallMessageUIProps {
  toolCall: {
    function: {
      name: string;
      arguments: string;
    };
  };
}

export const ToolCallMessageUI: React.FC<ToolCallMessageUIProps> = ({ toolCall }) => {
  return (
    <details
      style={{
        marginTop: '10px',
        padding: '5px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        background: '#f9f9f9',
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
        Tool Call: {toolCall.function.name}
      </summary>
      <pre style={{ whiteSpace: 'pre-wrap', marginTop: '10px', fontSize: '0.9em' }}>
        {toolCall.function.arguments}
      </pre>
    </details>
  );
};
