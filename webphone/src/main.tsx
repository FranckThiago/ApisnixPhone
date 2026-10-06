import { ErrorBoundary } from './components/ErrorBoundary';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppProvider } from './app/AppContext';
import { LinkGenerator } from './features/auth/LinkGenerator';
import './styles/tokens.css';
import './styles/app.css';

// `/lien` is the administrator's link generator: a page of its own, without the phone.
const page = location.pathname.replace(/\/+$/, '') === '/lien' ? <LinkGenerator /> : <AppProvider><App /></AppProvider>;
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary page>{page}</ErrorBoundary></StrictMode>);
