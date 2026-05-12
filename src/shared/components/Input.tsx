import React, { useRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className, ...props }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    if (inputRef.current) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(inputRef.current, '');
      inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  return (
    <div className={`input-group ${className || ''}`}>
      {label && <label>{label}</label>}
      <div className="input-wrapper">
        <input ref={inputRef} {...props} />
        <button type="button" className="clear-button" onClick={handleClear} aria-label="Clear input" tabIndex={-1}>
          &times;
        </button>
      </div>
    </div>
  );
};

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({ label, className, ...props }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleClear = () => {
    if (textareaRef.current) {
      const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      nativeTextareaValueSetter?.call(textareaRef.current, '');
      textareaRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  return (
    <div className={`input-group ${className || ''}`}>
      {label && <label>{label}</label>}
      <div className="input-wrapper">
        <textarea ref={textareaRef} {...props} />
        <button type="button" className="clear-button textarea-clear" onClick={handleClear} aria-label="Clear text" tabIndex={-1}>
          &times;
        </button>
      </div>
    </div>
  );
};
