import { cn } from '../cn.ts';

export interface SectionHeadingProps {
  id: string;
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeading({ id, title, subtitle, className }: SectionHeadingProps) {
  return (
    <div className={cn('mb-8 max-w-2xl md:mb-12', className)}>
      <h2 id={id} className="type-h1 text-text">
        {title}
      </h2>
      {subtitle ? <p className="mt-3 text-base text-text-muted md:text-lg">{subtitle}</p> : null}
    </div>
  );
}
