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
      if (q.type === 'single_select') return { selected: null, freetext: '' };
      return { selected: [] as string[], freetext: '' };
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

  const handleFreetextChange = (questionIndex: number, text: string) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = { ...newAnswers[questionIndex], freetext: text };
    setAnswers(newAnswers);
  };

  const handleSubmit = () => {
    const formattedAnswers = answers.map((ans, i) => {
      const q = safeQuestions[i];
      let response = '';
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
        </div>
      ))}
      <Button onClick={handleSubmit} variant="primary">
        Submit Answers
      </Button>
    </Panel>
  );
};
