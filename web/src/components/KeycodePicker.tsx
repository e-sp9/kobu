/**
 * Categorized keycode picker.
 *
 * The picker opens when a cell on the SVG is selected; choosing a
 * keycode commits it to the editor store via `applyKeyToSelection`.
 *
 * Categories follow the layout from issue #31 — Basic / Mods / Special
 * / Function / Media / System / Mouse / Layer / User / Other — with a
 * "Tap/Hold" tab that builds the parametric encodings (MT / LT / MO /
 * TG / TO / DF / OSL / OSM / WM / LM).
 *
 * Search is a single text input that scores against name, label,
 * description, and aliases across the active catalogue. A naive
 * scorer is good enough for ~300 keycodes — there is no perceivable
 * filter latency.
 */

import { useMemo, useState } from 'react';
import type { KeyboardLayoutDef } from '../protocol/handshake';
import {
  BASE_CATALOGUE,
  buildModBits,
  type Category,
  encodeDF,
  encodeLM,
  encodeLT,
  encodeMO,
  encodeMT,
  encodeOSL,
  encodeOSM,
  encodeTG,
  encodeTO,
  encodeWM,
  type KeycodeMeta,
  labelForKeycode,
  searchCatalogue,
  userCatalogue,
} from '../protocol/keycodes';

export interface KeycodePickerProps {
  definition: KeyboardLayoutDef;
  layerCount: number;
  /** Currently assigned keycode (used to preview "what's there now"). */
  current: number;
  onPick: (keycode: number) => void;
  onClose: () => void;
}

type Tab = Category | 'tap-hold';

const TAB_ORDER: { id: Tab; label: string }[] = [
  { id: 'basic', label: '基本' },
  { id: 'modifier', label: '修飾' },
  { id: 'special', label: '特殊' },
  { id: 'function', label: 'ファンクション' },
  { id: 'media', label: 'メディア' },
  { id: 'system', label: 'システム' },
  { id: 'mouse', label: 'マウス' },
  { id: 'layer', label: 'レイヤー' },
  { id: 'user', label: 'ユーザ' },
  { id: 'other', label: 'その他' },
  { id: 'tap-hold', label: 'タップ/ホールド' },
];

export function KeycodePicker({
  definition,
  layerCount,
  current,
  onPick,
  onClose,
}: KeycodePickerProps) {
  const [tab, setTab] = useState<Tab>('basic');
  const [query, setQuery] = useState('');

  const users = useMemo(() => userCatalogue(definition), [definition]);

  const catalogueByCategory = useMemo(() => {
    const groups = new Map<Category, KeycodeMeta[]>();
    for (const meta of BASE_CATALOGUE) {
      const list = groups.get(meta.category) ?? [];
      list.push(meta);
      groups.set(meta.category, list);
    }
    return groups;
  }, []);

  const activeList: KeycodeMeta[] = useMemo(() => {
    if (tab === 'tap-hold') return [];
    if (tab === 'user') return users.slice();
    return catalogueByCategory.get(tab) ?? [];
  }, [tab, users, catalogueByCategory]);

  const hits = useMemo(() => {
    if (!query) return activeList;
    const corpus = tab === 'user' ? users : [...BASE_CATALOGUE, ...users];
    return searchCatalogue(corpus, query).map((h) => h.meta);
  }, [query, activeList, tab, users]);

  const currentLabel = labelForKeycode(current, { definition });

  return (
    <div
      role="dialog"
      aria-label="キーコードを選択"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
        className="w-full max-w-4xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">キーコードを選択</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              現在の割り当て: <span className="font-mono">{currentLabel.long}</span>（0x
              {current.toString(16).padStart(4, '0')}）
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            閉じる
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          {TAB_ORDER.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'rounded-md px-2.5 py-1 text-xs font-medium border',
                tab === t.id
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 border-transparent'
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索…"
            // biome-ignore lint/a11y/noAutofocus: dialog is modal; focus belongs here
            autoFocus
            className="ml-auto rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1 text-sm w-48"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {tab === 'tap-hold' && !query ? (
            <TapHoldEditor layerCount={layerCount} definition={definition} onPick={onPick} />
          ) : (
            <KeyGrid items={hits} onPick={onPick} definition={definition} />
          )}
        </div>
      </div>
    </div>
  );
}

interface KeyGridProps {
  items: KeycodeMeta[];
  onPick: (kc: number) => void;
  definition: KeyboardLayoutDef;
}

function KeyGrid({ items, onPick }: KeyGridProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">該当するキーコードがありません。</p>
    );
  }
  return (
    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
      {items.map((meta) => (
        <button
          key={meta.code}
          type="button"
          onClick={() => onPick(meta.code)}
          title={meta.description}
          className="aspect-square rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-medium flex flex-col items-center justify-center px-1 text-center"
        >
          <span className="font-mono">{meta.shortLabel}</span>
          <span className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
            {meta.name}
          </span>
        </button>
      ))}
    </div>
  );
}

interface TapHoldEditorProps {
  layerCount: number;
  definition: KeyboardLayoutDef;
  onPick: (kc: number) => void;
}

function TapHoldEditor({ layerCount, onPick }: TapHoldEditorProps) {
  const [tapKey, setTapKey] = useState<number>(0x04); // default to "A"
  const [ctrl, setCtrl] = useState(false);
  const [shift, setShift] = useState(false);
  const [alt, setAlt] = useState(false);
  const [gui, setGui] = useState(false);
  const [right, setRight] = useState(false);

  const mod = buildModBits({ ctrl, shift, alt, gui, right });

  const baseKeys = useMemo(
    () => BASE_CATALOGUE.filter((k) => k.code >= 0x04 && k.code <= 0xff),
    [],
  );

  return (
    <div className="space-y-4 text-sm">
      <section className="space-y-2">
        <h3 className="font-semibold">レイヤー切替のみ</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(['MO', 'TO', 'TG', 'DF', 'OSL'] as const).map((kind) => (
            <div key={kind} className="space-y-1">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{kind}(レイヤー)</p>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: layerCount }, (_, n) => {
                  const layerKey = `${kind}-layer-${n}`;
                  return (
                    <button
                      key={layerKey}
                      type="button"
                      onClick={() => onPick(encodeFor(kind, n))}
                      className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">修飾キーの選択</h3>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {[
            ['Ctrl', ctrl, setCtrl] as const,
            ['Shift', shift, setShift] as const,
            ['Alt', alt, setAlt] as const,
            ['GUI', gui, setGui] as const,
          ].map(([label, value, set]) => (
            <label key={label} className="inline-flex items-center gap-1">
              <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
              {label}
            </label>
          ))}
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={right} onChange={(e) => setRight(e.target.checked)} />
            右側
          </label>
          <button
            type="button"
            onClick={() => onPick(encodeOSM(mod))}
            disabled={mod === 0}
            className="ml-2 rounded border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            OSM を割り当て
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">ベースキー（LT / MT / WM 用）</h3>
        <select
          value={tapKey}
          onChange={(e) => setTapKey(Number(e.target.value))}
          className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs"
        >
          {baseKeys.map((k) => (
            <option key={k.code} value={k.code}>
              {k.name}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">LT(レイヤー, キー) — レイヤータップ</h3>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: layerCount }, (_, n) => {
            const ltKey = `lt-${n}`;
            return (
              <button
                key={ltKey}
                type="button"
                onClick={() => onPick(encodeLT(n, tapKey))}
                className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                LT({n}, キー)
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">MT(キー, 修飾) — モッドタップ</h3>
        <button
          type="button"
          onClick={() => onPick(encodeMT(tapKey, mod))}
          disabled={mod === 0}
          className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          MT を割り当て
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">WM(キー, 修飾) — 修飾キー付き</h3>
        <button
          type="button"
          onClick={() => onPick(encodeWM(tapKey, mod))}
          disabled={mod === 0}
          className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          WM を割り当て
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">LM(レイヤー, 修飾) — レイヤー＋修飾</h3>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: layerCount }, (_, n) => {
            const lmKey = `lm-${n}`;
            return (
              <button
                key={lmKey}
                type="button"
                disabled={mod === 0}
                onClick={() => onPick(encodeLM(n, mod))}
                className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                LM({n})
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function encodeFor(kind: 'MO' | 'TO' | 'TG' | 'DF' | 'OSL', layer: number): number {
  switch (kind) {
    case 'MO':
      return encodeMO(layer);
    case 'TO':
      return encodeTO(layer);
    case 'TG':
      return encodeTG(layer);
    case 'DF':
      return encodeDF(layer);
    case 'OSL':
      return encodeOSL(layer);
  }
}
