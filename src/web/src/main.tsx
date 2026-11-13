import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
