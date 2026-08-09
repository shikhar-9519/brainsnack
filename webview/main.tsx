import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Bundled locally — the webview CSP blocks external font hosts.
import './fonts.css';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
