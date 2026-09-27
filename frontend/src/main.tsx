import './index.css';
// Lenis' required base rules. Must come after index.css so our own
// scroll/overflow declarations win where the two overlap.
import 'lenis/dist/lenis.css';
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
