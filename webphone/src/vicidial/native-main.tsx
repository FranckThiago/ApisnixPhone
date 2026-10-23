import { createRoot } from 'react-dom/client';
import { NativeConference } from './NativeConference';
import { ErrorBoundary } from '../components/ErrorBoundary';
import '../styles/tokens.css';
import '../styles/app.css';
import '../embed/embed.css';
createRoot(document.getElementById('root')!).render(<ErrorBoundary page><NativeConference /></ErrorBoundary>);
