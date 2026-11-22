'use client';

import type { Locale } from '@knj/i18n';
import type { Values } from '@knj/physics';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

// Each lab is its own chunk: pages load only the simulation they show.
const UniformMotionLab = dynamic(() => import('./uniform-motion-lab'));
const ProjectileLab = dynamic(() => import('./projectile-lab'));

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
    default:
      return null;
  }
}
