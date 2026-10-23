import { ErrorBoundary } from './components/ErrorBoundary';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppProvider } from './app/AppContext';
import { LinkGenerator } from './features/auth/LinkGenerator';
import { EmbeddedPhone } from './embed/EmbeddedPhone';
import { IntegrationDemo } from './embed/IntegrationDemo';
import './styles/tokens.css';
import './styles/app.css';
import './embed/embed.css';

// `/lien` is the administrator's link generator: a page of its own, without the phone.
const path = location.pathname.replace(/\/+$/, '');
// Every framed route uses the gate; / and /lien cannot bypass embedded authentication.
const page = path === '/embed' || window.parent !== window ? <EmbeddedPhone />
  : path === '/integration-demo' && import.meta.env.VITE_APP_MODE !== 'live' ? <IntegrationDemo />
  : path === '/lien' ? <LinkGenerator /> : <AppProvider><App /></AppProvider>;
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary page>{page}</ErrorBoundary></StrictMode>);
