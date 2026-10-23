import { ErrorBoundary } from './components/ErrorBoundary';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppProvider } from './app/AppContext';
import { LinkGenerator } from './features/auth/LinkGenerator';
import { EmbeddedPhone } from './embed/EmbeddedPhone';
import { IntegrationDemo } from './embed/IntegrationDemo';
import { pilotEnabled } from './vicidial/pilotGate';
import './styles/tokens.css';
import './styles/app.css';
import './embed/embed.css';

// `/lien` is the administrator's link generator: a page of its own, without the phone.
const path = location.pathname.replace(/\/+$/, '');
// This local experiment cannot be selected in a live or built release, even by framing its URL.
const pilot = import.meta.env.DEV && pilotEnabled(import.meta.env.DEV, import.meta.env.VITE_APP_MODE, location.hostname)
  && path === '/vicidial-pilot-phone';
// Entrypoint owns this lazy route; no component is hot-reloaded from this file.
// eslint-disable-next-line react-refresh/only-export-components
const ConferencePilot = import.meta.env.DEV
  ? lazy(() => import('./vicidial/ConferencePilot').then(module => ({ default: module.ConferencePilot }))) : () => null;
// Every framed route uses the gate; / and /lien cannot bypass embedded authentication.
const page = pilot ? <Suspense><ConferencePilot /></Suspense> : path === '/embed' || window.parent !== window ? <EmbeddedPhone />
  : path === '/integration-demo' && import.meta.env.VITE_APP_MODE !== 'live' ? <IntegrationDemo />
  : path === '/lien' ? <LinkGenerator /> : <AppProvider><App /></AppProvider>;
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary page>{page}</ErrorBoundary></StrictMode>);
