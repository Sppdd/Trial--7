import React from 'react';

export const Alert = ({ children, variant = 'default', className = '' }) => {
  const baseStyles = 'p-4 rounded-lg mb-4';
  const variantStyles = {
    default: 'bg-blue-50 text-blue-900',
    destructive: 'bg-red-50 text-red-900',
  };

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
};

export const AlertTitle = ({ children, className = '' }) => {
  return (
    <h5 className={`font-medium mb-1 ${className}`}>
      {children}
    </h5>
  );
};

export const AlertDescription = ({ children, className = '' }) => {
  return (
    <div className={`text-sm ${className}`}>
      {children}
    </div>
  );
}; 