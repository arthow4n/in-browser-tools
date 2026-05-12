import React from 'react';
import './styles.css';

export const PageLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <div className="container">
      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        <a href="./">← Back to Tools</a>
      </div>
      {children}
    </div>
  );
};
