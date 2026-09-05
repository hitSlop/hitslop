import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ready } from '@hitslop/runtime';
import App from './App.tsx';
import './styles.css';
// Render synchronously so capture targets exist before signalling readiness.
const root = createRoot(document.getElementById('app')!);
flushSync(() => root.render(<App />));
ready();
