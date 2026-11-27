import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, buttonVariants, cn } from './index.ts';

describe('cn', () => {
  it('resolves conflicting tailwind classes', () => {
    expect(cn('px-2', 'px-4', false && 'hidden')).toBe('px-4');
  });
});

describe('Button', () => {
  it('defaults to type=button and primary styles', () => {
    render(<Button>Ok</Button>);
    const btn = screen.getByRole('button', { name: 'Ok' });
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.className).toContain('bg-accent');
  });

  it('exposes variants for links', () => {
    expect(buttonVariants({ variant: 'secondary' })).toContain('border-border');
  });
});

describe('TextField', async () => {
  const { TextField, Alert } = await import('./index.ts');
  it('links label, input and error for assistive tech', () => {
    render(<TextField label="E-mail" name="email" error="Неверный e-mail" />);
    const input = screen.getByLabelText('E-mail');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const errorId = input.getAttribute('aria-describedby')!;
    expect(document.getElementById(errorId)?.textContent).toBe('Неверный e-mail');
  });

  it('announces errors as alerts', () => {
    render(<Alert tone="error">Ошибка</Alert>);
    expect(screen.getByRole('alert').textContent).toBe('Ошибка');
  });
});

describe('SubjectTile and Progress', async () => {
  const { SubjectTile, Progress } = await import('./index.ts');
  it('renders a subject tile as a link with the subject tint', () => {
    render(<SubjectTile subject="physics" title="Физика" meta="Лаборатории" href="#physics" />);
    const link = screen.getByRole('link', { name: /Физика/ });
    expect(link.getAttribute('href')).toBe('#physics');
    expect(link.className).toContain('text-physics');
  });

  it('exposes progress to assistive tech and clamps the bar', () => {
    render(<Progress label="Плотность" value={7} max={5} tone="geometry" />);
    const bar = screen.getByRole('progressbar', { name: 'Плотность' });
    expect(bar.getAttribute('aria-valuenow')).toBe('7');
    expect((bar.firstChild as HTMLElement).style.width).toBe('100%');
  });
});
