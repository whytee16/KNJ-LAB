'use client';

import type { Locale } from '@knj/i18n';
import type { Values } from '@knj/physics';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

// Each lab is its own chunk: pages load only the simulation they show.
const UniformMotionLab = dynamic(() => import('./uniform-motion-lab'));
const ProjectileLab = dynamic(() => import('./projectile-lab'));
const InclineLab = dynamic(() => import('./incline-lab'));
const PendulumLab = dynamic(() => import('./pendulum-lab'));
const SpringLab = dynamic(() => import('./spring-lab'));
const CircuitLab = dynamic(() => import('./circuit-lab'));

export interface LabViewProps {
  code: string;
  locale: Locale;
  header: ReactNode;
  defaults: Values;
  initial: Values;
  canSave: boolean;
  children?: ReactNode;
}

/** Picks the view for a lab code (models and views live in code, see ADR-0008). */
export function LabView(props: LabViewProps) {
  switch (props.code) {
    case 'uniform-motion':
      return (
        <UniformMotionLab
          {...props}
          defaults={props.defaults as { v: number; t: number; x0: number }}
          initial={props.initial as { v: number; t: number; x0: number }}
        />
      );
    case 'projectile':
      return (
        <ProjectileLab
          {...props}
          defaults={props.defaults as { v0: number; angle: number; h0: number; g: number }}
          initial={props.initial as { v0: number; angle: number; h0: number; g: number }}
        />
      );
    case 'inclined-plane':
      return (
        <InclineLab
          {...props}
          defaults={
            props.defaults as { angle: number; m: number; mu: number; L: number; g: number }
          }
          initial={props.initial as { angle: number; m: number; mu: number; L: number; g: number }}
        />
      );
    case 'math-pendulum':
      return (
        <PendulumLab
          {...props}
          defaults={props.defaults as { l: number; theta0: number; m: number; g: number }}
          initial={props.initial as { l: number; theta0: number; m: number; g: number }}
        />
      );
    case 'spring-pendulum':
      return (
        <SpringLab
          {...props}
          defaults={props.defaults as { m: number; k: number; A: number }}
          initial={props.initial as { m: number; k: number; A: number }}
        />
      );
    case 'circuit':
      return (
        <CircuitLab
          {...props}
          defaults={
            props.defaults as { emf: number; r: number; R1: number; R2: number; mode: number }
          }
          initial={
            props.initial as { emf: number; r: number; R1: number; R2: number; mode: number }
          }
        />
      );
    default:
      return null;
  }
}
