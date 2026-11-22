import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameControls, GameReadouts, ParamControl, snapToRange, ticks } from './index.ts';

afterEach(cleanup);

const spec = { min: 0, max: 30, step: 0.5 };

function Harness({ onReset }: { onReset?: () => void }) {
  const [v, setV] = useState(5);
  return (
    <GameControls
      running={false}
      onRun={() => {}}
      onPause={() => {}}
      onReset={() => {
        setV(5);
        onReset?.();
      }}
      labels={{ run: 'Запуск', pause: 'Пауза', reset: 'Сброс' }}
    >
      <ParamControl
        label="Скорость"
        symbol="v"
        unit="м/с"
        spec={spec}
        value={v}
        onChange={setV}
        rangeError="Допустимо от 0 до 30"
      />
      <output data-testid="v">{v}</output>
    </GameControls>
  );
}

describe('ParamControl', () => {
  it('keeps slider and number field in sync', () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole('slider', { name: 'Скорость' }), { target: { value: '12' } });
    expect(screen.getByTestId('v').textContent).toBe('12');
    expect(
      (screen.getByLabelText(/Скорость/, { selector: 'input[inputmode]' }) as HTMLInputElement)
        .value,
    ).toBe('12');

    const num = screen.getByLabelText(/Скорость/, { selector: 'input[inputmode]' });
    fireEvent.change(num, { target: { value: '7,3' } });
    fireEvent.blur(num);
    expect(screen.getByTestId('v').textContent).toBe('7.5');
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('7.5');
  });

  it('rejects out-of-range values and shows the range', () => {
    render(<Harness />);
    const num = screen.getByLabelText(/Скорость/, { selector: 'input[inputmode]' });
    fireEvent.change(num, { target: { value: '45' } });
    fireEvent.keyDown(num, { key: 'Enter' });
    expect(screen.getByText('Допустимо от 0 до 30')).toBeTruthy();
    expect(num.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByTestId('v').textContent).toBe('5');
  });

  it('reset returns defaults', () => {
    const onReset = vi.fn();
    render(<Harness onReset={onReset} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '20' } });
    act(() => screen.getByRole('button', { name: 'Сброс' }).click());
    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.getByTestId('v').textContent).toBe('5');
  });
});

describe('readouts and chart helpers', () => {
  it('announces readouts politely', () => {
    render(
      <GameReadouts
        title="Приборы"
        items={[{ id: 'S', label: 'Путь', symbol: 'S', value: '50', unit: 'м' }]}
      />,
    );
    expect(
      screen.getByText('Путь', { exact: false }).closest('[aria-live]')?.getAttribute('aria-live'),
    ).toBe('polite');
  });

  it('snaps and builds nice ticks', () => {
    expect(snapToRange(spec, 0.3)).toBe(0.5);
    expect(snapToRange(spec, 99)).toBe(30);
    expect(ticks(20)).toEqual([0, 5, 10, 15, 20]);
    expect(ticks(600)).toEqual([0, 200, 400, 600]);
    // The top tick covers the maximum even when it is not a multiple of the step.
    expect(ticks(120)).toEqual([0, 25, 50, 75, 100, 125]);
  });
});

describe('GameChart', async () => {
  const { GameChart } = await import('./index.ts');
  it('draws extra lines with a legend and a symmetric axis for oscillations', () => {
    const { container } = render(
      <GameChart
        title="Энергия"
        xLabel="t"
        yLabel="E"
        label="Полная"
        series={[
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ]}
        more={[
          {
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
            tone: 'success',
            label: 'Кинетическая',
          },
          {
            points: [
              { x: 0, y: 1 },
              { x: 1, y: 0 },
            ],
            tone: 'info',
            label: 'Потенциальная',
          },
        ]}
        xMax={1}
        yMax={1}
        yMin={-1}
        description="d"
      />,
    );
    expect(container.querySelectorAll('path')).toHaveLength(3);
    expect(screen.getByText('Кинетическая')).toBeTruthy();
    expect(screen.getByText('-1')).toBeTruthy(); // negative half of the axis
  });
});
