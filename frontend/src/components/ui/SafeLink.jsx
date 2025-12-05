// frontend/src/components/ui/SafeLink.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const SafeLink = ({ to, children, className, onClick, isFormDirty, ...props }) => {
  const handleClick = (e) => {
    if (isFormDirty && onClick) {
      const confirmLeave = window.confirm(
        'У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу? Изменения будут потеряны.'
      );
      if (!confirmLeave) {
        e.preventDefault();
        return;
      }
    }
    if (onClick) onClick(e);
  };

  return (
    <Link 
      to={to} 
      className={className} 
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  );
};

export default SafeLink;