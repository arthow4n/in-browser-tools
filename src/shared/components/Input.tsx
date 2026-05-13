import React, { useRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  containerStyle?: React.CSSProperties;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, className, containerStyle, ...props }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);

    const mergedRef = React.useMemo(() => {
      return (el: HTMLInputElement | null) => {
        (internalRef as any).current = el;
        if (typeof ref === 'function') {
          ref(el);
        } else if (ref) {
          (ref as any).current = el;
        }
      };
    }, [ref]);

    const handleClear = () => {
      if (internalRef.current) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        nativeInputValueSetter?.call(internalRef.current, '');
        internalRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    const isCheckboxOrRadio = ['checkbox', 'radio'].includes(props.type || '');
    const isFile = props.type === 'file';

    if (isCheckboxOrRadio) {
      return (
        <label
          className={`checkbox-label ${className || ''}`.trim()}
          style={containerStyle}
        >
          <input ref={mergedRef} {...props} />
          {label && <span>{label}</span>}
        </label>
      );
    }

    if (isFile) {
      return (
        <div
          className={`input-group ${className || ''}`.trim()}
          style={containerStyle}
        >
          {label && <label>{label}</label>}
          <input ref={mergedRef} {...props} />
        </div>
      );
    }

    return (
      <div
        className={`input-group ${className || ''}`.trim()}
        style={containerStyle}
      >
        {label && <label>{label}</label>}
        <div className="input-wrapper">
          <input ref={mergedRef} {...props} />
          <button
            type="button"
            className="clear-button"
            onClick={handleClear}
            aria-label="Clear input"
            tabIndex={-1}
          >
            &times;
          </button>
        </div>
      </div>
    );
  },
);

Input.displayName = 'Input';
