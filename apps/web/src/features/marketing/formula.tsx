import { renderLatex } from '@/lib/katex';

/** Server-rendered KaTeX formula (input is trusted, authored in code or reviewed content). */
export function Formula({ latex, display = false }: { latex: string; display?: boolean }) {
  return (
    <span
      className="max-w-full overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: renderLatex(latex, display) }}
    />
  );
}
