import { Component, type ReactNode } from 'react';
import { t } from '../i18n';
import { MANUAL_SIGN_IN_URL, requireManualSignIn } from '../features/auth/recovery';
/** Contains rendering failures without logging call data or touching the phone controller. */
export class ErrorBoundary extends Component<{ children: ReactNode; page?: boolean }, { failed: boolean; confirming: boolean }> {
  state = { failed: false, confirming: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { requireManualSignIn(); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section className={this.props.page ? 'recovery-page' : 'panel recovery-panel'} role="alert">
      <h1>{t('recovery.title')}</h1>
      <p>{t(this.props.page ? 'recovery.page' : 'recovery.section')}</p>
      <p>{t('recovery.kept')}</p>
      <div className="detail-actions">
        {!this.props.page && <button type="button" className="primary" onClick={() => this.setState({ failed: false, confirming: false })}>{t('action.retry')}</button>}
        {!this.state.confirming && <button type="button" className="ghost" onClick={() => this.setState({ confirming: true })}>{t('recovery.signIn')}</button>}
        {this.state.confirming && <div>
          <p>{t('recovery.confirm')}</p>
          <button type="button" className="ghost" onClick={() => this.setState({ confirming: false })}>{t('action.cancel')}</button>
          <a className="ghost" href={MANUAL_SIGN_IN_URL}>{t('recovery.signIn')}</a>
        </div>}
      </div>
    </section>;
  }
}
