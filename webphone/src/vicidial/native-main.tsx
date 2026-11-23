import { createRoot } from 'react-dom/client';
import { NativeConference } from './NativeConference';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { startLayout } from '../app/layout';
import '../styles/tokens.css';
import '../styles/app.css';
import '../embed/embed.css';
startLayout();
createRoot(document.getElementById('root')!).render(<ErrorBoundary page><NativeConference /></ErrorBoundary>);
