import React, { useState } from 'react';
import { Button } from './Button.js';
import { Panel } from './Panel.js';

export interface Question {
  text: string;
  type: 'single_select' | 'multi_select';
  options: string[];
  allow_freetext?: boolean;
}

export interface AskQuestionUIProps {
  questions: Question[];
  onComplete: (answers: any[]) => void;
}

export const AskQuestionUI: React.FC<AskQuestionUIProps> = ({
  questions,
  onComplete,
}) => {
  const safeQuestions = Array.isArray(questions) ? questions : [];

  const [answers, setAnswers] = useState<any[]>(
    safeQuestions.map((q) => {
      if (q.type === 'single_select') return { selected: null, freetext: '', refused: false, refuseReason: '' };
      return { selected: [] as string[], freetext: '', refused: false, refuseReason: '' };
    }),
  );

  if (safeQuestions.length === 0) return null;

  const handleSingleSelect = (questionIndex: number, option: string) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = { ...newAnswers[questionIndex], selected: option };
    setAnswers(newAnswers);
  };

  const handleMultiSelect = (questionIndex: number, option: string) => {
    const newAnswers = [...answers];
    const selectedList = newAnswers[questionIndex].selected as string[];
    if (selectedList.includes(option)) {
      newAnswers[questionIndex] = {
        ...newAnswers[questionIndex],
        selected: selectedList.filter((opt) => opt !== option),
      };
    } else {
      newAnswers[questionIndex] = {
        ...newAnswers[questionIndex],
        selected: [...selectedList, option],
      };
    }
    setAnswers(newAnswers);
  };

  const handleRefuseToggle = (questionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = { ...newAnswers[questionIndex], refused: !newAnswers[questionIndex].refused };
    setAnswers(newAnswers);
  };

  const handleRefuseReasonChange = (questionIndex: number, text: string) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = { ...newAnswers[questionIndex], refuseReason: text };
    setAnswers(newAnswers);
  };

  const handleRefuseAll = () => {
    const newAnswers = answers.map((ans) => ({ ...ans, refused: true }));
    setAnswers(newAnswers);
    // Directly submit after state update (setTimeout to wait for re-render if needed, but we can just map and call onComplete)
    const formattedAnswers = newAnswers.map((ans, i) => {
      let response = 'Refused to answer';
      if (ans.refuseReason) {
        response += ` | Reason: ${ans.refuseReason}`;
      }
      return response;
    });
    onComplete(formattedAnswers);
  };

  const handleFreetextChange = (questionIndex: number, text: string) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = { ...newAnswers[questionIndex], freetext: text };
    setAnswers(newAnswers);
  };

  const handleSubmit = () => {
    const formattedAnswers = answers.map((ans, i) => {
      const q = safeQuestions[i];
      let response = '';

      if (ans.refused) {
        response = 'Refused to answer';
        if (ans.refuseReason) {
          response += ` | Reason: ${ans.refuseReason}`;
        }
        return response;
      }

      if (q.type === 'single_select') {
        response = `Selected: ${ans.selected || 'None'}`;
      } else if (q.type === 'multi_select') {
        response = `Selected: ${ans.selected.length > 0 ? ans.selected.join(', ') : 'None'}`;
      }

      if (q.allow_freetext !== false && ans.freetext) {
        response += ` | Freetext: ${ans.freetext}`;
      }
      return response;
    });

    onComplete(formattedAnswers);
  };

  return (
    <Panel title="Please answer the following questions:">
      {safeQuestions.map((q, i) => (
        <div key={i} style={{ marginBottom: '20px' }}>
          <h4>{i + 1}. {q.text}</h4>

          <div style={{ marginBottom: '10px' }}>
            <Button
              variant={answers[i].refused ? 'danger' : 'secondary'}
              onClick={() => handleRefuseToggle(i)}
            >
              {answers[i].refused ? 'Cancel Refusal' : 'Refuse to Answer'}
            </Button>
          </div>

          {answers[i].refused ? (
            <input
              type="text"
              placeholder="Reason for refusing (optional)"
              value={answers[i].refuseReason}
              onChange={(e) => handleRefuseReasonChange(i, e.target.value)}
              className="form-control"
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          ) : (
            <>
              {q.type === 'single_select' && Array.isArray(q.options) && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {q.options.map((opt) => (
                <Button
                  key={opt}
                  variant={answers[i].selected === opt ? 'primary' : 'secondary'}
                  onClick={() => handleSingleSelect(i, opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>
          )}

          {q.type === 'multi_select' && Array.isArray(q.options) && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {q.options.map((opt) => (
                <Button
                  key={opt}
                  variant={answers[i].selected.includes(opt) ? 'primary' : 'secondary'}
                  onClick={() => handleMultiSelect(i, opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>
          )}

          {q.allow_freetext !== false && (
            <input
              type="text"
              placeholder="Additional comments (freetext)"
              value={answers[i].freetext}
              onChange={(e) => handleFreetextChange(i, e.target.value)}
              className="form-control"
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          )}
            </>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: '10px' }}>
        <Button onClick={handleSubmit} variant="primary">
          Submit Answers
        </Button>
        <Button onClick={handleRefuseAll} variant="danger">
          Refuse All
        </Button>
      </div>
    </Panel>
  );
};
