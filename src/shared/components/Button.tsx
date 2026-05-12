import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', loading, children, disabled, className, ...props }) => {
  const baseClass = `btn btn-${variant}`;
  const combinedClass = className ? `${baseClass} ${className}` : baseClass;

  return (
    <button className={combinedClass} disabled={disabled || loading} {...props}>
      {loading ? 'Loading...' : children}
    </button>
  );
};
