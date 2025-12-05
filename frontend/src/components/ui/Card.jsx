import React from 'react';
import './Card.css'; // Добавим немного стилей для наглядности

// Компонент-обертка для контента, обеспечивающий единый стиль
const Card = ({ children, className = '' }) => {
  return <div className={`card ${className}`}>{children}</div>;
};

export default Card;