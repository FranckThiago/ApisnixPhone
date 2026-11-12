import app from '../src/app/AppContext.tsx?raw';
import dock from '../src/features/calls/PhoneDock.tsx?raw';
import { createElement, type ReactElement } from 'react';
import { transpileModule, JsxEmit, ScriptTarget } from 'typescript';
import { describe, expect, it } from 'vitest';
import { parseDialInput, describeNumber } from '../src/domain/numbers';

// Execute the actual callback and JSX with isolated hooks/controllers. No browser,
// SIP connection or copied implementation of the dialing/recall decision.
const callSource = app.slice(app.indexOf('  const placeCall = useCallback('), app.indexOf('  const reopenRecordings ='));
const dialerSource = dock.slice(dock.indexOf('function Dialer()'), dock.indexOf('/** Shared by idle'));
function execute(source: string, context: Record<string, unknown>) {
  const code = transpileModule(source, { compilerOptions: { target: ScriptTarget.ES2022, jsx: JsxEmit.React } }).outputText;
  return new Function(...Object.keys(context), code)(...Object.values(context));
}
type Started = { id: string; direction: string; rawInput: string; phase: string };
function calling() {
  const state = { connection: 'ready', call: null as Started | null };
  const memory = { last: '00123', dial: 'new input' }, attempts: string[][] = [];
  let accept = true;
  const phone = { getSnapshot: () => ({ ...state }), dismiss: () => { state.call = null; },
    call: (rawInput: string, target: string) => {
      if (!accept) return;
      attempts.push([rawInput, target]); state.call = { id: String(attempts.length), direction: 'outbound', rawInput, phase: 'dialing' };
    } };
  const placeCall = execute(callSource + '\nreturn placeCall;', {
    useCallback: (fn: unknown) => fn, parseDialInput, phone, notify: () => undefined, t: (s: string) => s,
    store: { getSnapshot: () => ({ contacts: [] }) }, findContact: () => undefined,
    setLastDial: (value: string) => { memory.last = value; }, setDial: (value: string) => { memory.dial = value; },
  }) as (raw: string) => void;
  return { state, memory, attempts, placeCall, refuse: () => { accept = false; } };
}
type Node = ReactElement<{ className?: string; id?: string; disabled?: boolean; onClick?: () => void; onKeyDown?: (event: { key: string }) => void; children?: unknown }>;
function renderDialer(dial: string, lastDial: string, connection = 'ready') {
  const calls: string[] = [];
  const tree = execute(dialerSource + '\nreturn Dialer();', {
    React: { createElement, Fragment: 'fragment' }, useApp: () => ({ dial, lastDial, setDial: () => undefined, placeCall: (raw: string) => calls.push(raw) }),
    usePhone: () => ({ connection }), useData: () => ({ contacts: [] }), useI18n: () => ({ t: (s: string) => s }),
    useRef: () => ({ current: null }), useMemo: (fn: () => unknown) => fn(), parseDialInput, describeNumber,
    findContact: () => undefined, searchContacts: () => [],
    ConnectionPill: 'connection', Keypad: 'keypad', DueCallbacks: 'callbacks', Phone: 'phone', Kbd: 'kbd',
    Flag: 'flag', Delete: 'delete', countryLabel: () => '',
  }) as Node;
  const nodes: Node[] = [];
  function visit(value: unknown) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object' && 'props' in value) { const node = value as Node; nodes.push(node); visit(node.props.children); }
  }
  visit(tree);
  return { calls, button: nodes.find(n => n.props.className === 'call-button')!, input: nodes.find(n => n.props.id === 'dial-input')! };
}
describe('last outgoing number', () => {
  it('remembers original input only after the phone accepts an outgoing attempt', () => {
    const h = calling(); h.placeCall('00633 612345678');
    expect(h.attempts).toEqual([['00633 612345678', '00633612345678']]);
    expect(h.memory).toEqual({ last: '00633 612345678', dial: '' });
  });
  it('refused, invalid, offline and busy attempts never replace the recall memory', () => {
    for (const mode of ['invalid', 'offline', 'busy', 'refused']) {
      const h = calling();
      if (mode === 'offline') h.state.connection = 'offline';
      if (mode === 'busy') h.state.call = { id: 'incoming', direction: 'inbound', rawInput: '', phase: 'active' };
      if (mode === 'refused') h.refuse();
      h.placeCall(mode === 'invalid' ? 'abc' : '633612345678');
      expect(h.memory).toEqual({ last: '00123', dial: 'new input' }); expect(h.attempts).toEqual([]);
    }
  });
  it('finishing wrap-up permits a new attempt and replaces the remembered input', () => {
    const h = calling(); h.state.call = { id: 'old', direction: 'outbound', rawInput: '00123', phase: 'ended' };
    h.placeCall('815145550100'); expect(h.memory.last).toBe('815145550100'); expect(h.attempts).toHaveLength(1);
  });
  it('empty button and Enter redial the original prefix; a new number takes priority', () => {
    for (const dial of ['', '90033612345678']) {
      const h = renderDialer(dial, '00633612345678'); expect(h.button.props.disabled).toBe(false);
      h.button.props.onClick!(); h.input.props.onKeyDown!({ key: 'Enter' });
      expect(h.calls).toEqual([dial || '00633612345678', dial || '00633612345678']);
    }
  });
  it('no prior number, invalid new text and offline line keep the button disabled', () => {
    for (const [dial, last, connection] of [['', '', 'ready'], ['abc', '00123', 'ready'], ['', '00123', 'offline']]) {
      const h = renderDialer(dial!, last!, connection); expect(h.button.props.disabled).toBe(true);
      h.input.props.onKeyDown!({ key: 'Enter' }); expect(h.calls).toEqual([]);
    }
  });
});
