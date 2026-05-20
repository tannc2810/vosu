import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const originalConsoleError = console.error;
console.error = (...args) => {
  if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('Cannot set property fetch of #<Window>')) return;
  if (args[0] && args[0] instanceof Error && args[0].message.includes('Cannot set property fetch of #<Window>')) return;
  originalConsoleError(...args);
};

window.addEventListener('error', (event) => {
  if (event.message?.includes('Cannot set property fetch of #<Window>')) {
    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('Cannot set property fetch of #<Window>')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
