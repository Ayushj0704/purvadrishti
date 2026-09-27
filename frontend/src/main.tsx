import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const container = document.getElementById('root') || document.getElementById('app');

if (!container) {
  throw new Error('Failed to find root container element');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
