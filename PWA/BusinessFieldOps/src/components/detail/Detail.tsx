import './Detail.css';

import type {ComponentChildren, JSX} from 'preact';

import {joinClasses} from '@/components/list/classNames';

/** A titled block of a read-only screen. */
export function DetailSection({
  title,
  children,
  className,
  highlight = false,
}: {
  title: string;
  children: ComponentChildren;
  className?: string;
  highlight?: boolean;
}): JSX.Element {
  return (
    <section class={joinClasses('detail-section', className)}>
      <h3
        class={joinClasses('detail-section__title', highlight && 'highlight')}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Lays out `DetailField`s in as many columns as fit. */
export function DetailGrid({
  children,
}: {
  children: ComponentChildren;
}): JSX.Element {
  return <div class="detail-grid">{children}</div>;
}

/** A small label over a value. */
export function DetailField({
  label,
  children,
}: {
  label: string;
  children: ComponentChildren;
}): JSX.Element {
  return (
    <div class="detail-field">
      <span class="detail-field__label">{label}</span>
      <span class="detail-field__value">{children}</span>
    </div>
  );
}

/** A row of `DetailStat`s: four equal numbers (counts, totals...). */
export function DetailStats({
  children,
}: {
  children: ComponentChildren;
}): JSX.Element {
  return <div class="detail-stats">{children}</div>;
}

/** A number with its label under it. */
export function DetailStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}): JSX.Element {
  return (
    <div class="detail-stat">
      <span class="detail-stat__value">{value}</span>
      <span class="detail-stat__label">{label}</span>
    </div>
  );
}

export type DetailTone = 'neutral' | 'ok' | 'error' | 'info';

/** A short status label (sent, active, failed...). */
export function DetailBadge({
  tone = 'neutral',
  children,
}: {
  tone?: DetailTone;
  children: ComponentChildren;
}): JSX.Element {
  return (
    <span class={joinClasses('detail-badge', `detail-badge--${tone}`)}>
      {children}
    </span>
  );
}
