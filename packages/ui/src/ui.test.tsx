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
