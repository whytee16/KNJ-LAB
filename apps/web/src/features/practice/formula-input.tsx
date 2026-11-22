'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Formula input. Starts as a plain LaTeX text field (works without JS) and upgrades to a
 * MathLive editor once its bundle has loaded; the value is always mirrored into `onChange`.
 */
export function FormulaInput({
  id,
  label,
  onChange,
}: {
  id: string;
  label: string;
  onChange: (latex: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import('mathlive').then(({ MathfieldElement }) => {
      if (cancelled || !host.current) return;
      // KaTeX fonts are already on the page; MathLive must not fetch its own or play sounds.
      MathfieldElement.fontsDirectory = null;
      MathfieldElement.soundsDirectory = null;
      const field = new MathfieldElement();
      field.id = id;
      field.setAttribute('aria-label', label);
      field.mathVirtualKeyboardPolicy = 'auto';
      field.className =
        'block min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-lg';
      field.addEventListener('input', () => onChange(field.value));
      host.current.replaceChildren(field);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, label, onChange]);

  return (
    <div ref={host} data-testid="formula-input" data-ready={ready ? 'true' : undefined}>
      <input
        id={id}
        aria-label={label}
        className="min-h-11 w-full rounded-md border border-border bg-surface px-3 font-mono"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
