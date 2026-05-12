import React from 'react';

export const Panel: React.FC<{ children: React.ReactNode; title?: string }> = ({
  children,
  title,
}) => {
  return (
    <div className="panel">
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
};
