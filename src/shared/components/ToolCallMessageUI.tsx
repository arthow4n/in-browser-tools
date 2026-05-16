import React, { useEffect, useState } from 'react';
import { AskQuestionUI } from './AskQuestionUI.js';

interface ToolCallMessageUIProps {
  toolCall: {
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  };
}

export const ToolCallMessageUI: React.FC<ToolCallMessageUIProps> = ({ toolCall }) => {
  const [askQuestionData, setAskQuestionData] = useState<any>(null);

  useEffect(() => {
    if (toolCall.function.name === 'ask_question') {
      const checkPending = () => {
        const w = window as any;
        if (w.pendingAskQuestions && w.pendingAskQuestions[toolCall.id]) {
          setAskQuestionData(w.pendingAskQuestions[toolCall.id]);
        } else {
          setAskQuestionData(null);
        }
      };

      // Initial check
      checkPending();

      // Listen for updates
      const handleUpdate = (e: any) => {
        if (e.detail?.toolCallId === toolCall.id) {
          checkPending();
        }
      };
      window.addEventListener('askQuestionUpdate', handleUpdate);

      return () => {
        window.removeEventListener('askQuestionUpdate', handleUpdate);
      };
    }
  }, [toolCall.id, toolCall.function.name]);

  const handleComplete = (answers: any[]) => {
    if (askQuestionData && askQuestionData.resolve) {
      askQuestionData.resolve(answers);
      const w = window as any;
      if (w.pendingAskQuestions) {
        delete w.pendingAskQuestions[toolCall.id];
      }
      setAskQuestionData(null);
      window.dispatchEvent(new CustomEvent('askQuestionUpdate', { detail: { toolCallId: toolCall.id } }));
    }
  };

  const isPendingAskQuestion = askQuestionData !== null;

  let parsedArgs: any = {};
  try {
    parsedArgs = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    // Ignore parse errors, args might be incomplete during streaming
  }

  const hideDetails = parsedArgs?.hide_details;
  let isOpen = undefined;
  if (isPendingAskQuestion) {
    isOpen = true;
  } else if (hideDetails === false) {
    isOpen = true;
  }

  return (
    <details
      open={isOpen}
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
      {isPendingAskQuestion && (
        <div style={{ marginTop: '15px' }}>
          <AskQuestionUI
            questions={askQuestionData.questions}
            onComplete={handleComplete}
          />
        </div>
      )}
    </details>
  );
};
