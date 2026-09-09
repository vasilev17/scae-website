import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

const DEFAULT_CELL_SIZE = 56;

type Cell = {
  row: number;
  col: number;
};

export const BackgroundRippleEffect = ({
  rows: rowsProp,
  cols: colsProp,
  cellSize = DEFAULT_CELL_SIZE,
}: {
  rows?: number;
  cols?: number;
  cellSize?: number;
}) => {
  const hitRef = useRef<HTMLDivElement>(null);
  const [clickedCell, setClickedCell] = useState<Cell | null>(null);
  const [hoveredCell, setHoveredCell] = useState<Cell | null>(null);
  const [rippleKey, setRippleKey] = useState(0);
  const [rippling, setRippling] = useState(false);
  const [grid, setGrid] = useState({
    rows: rowsProp ?? 8,
    cols: colsProp ?? 27,
  });

  useEffect(() => {
    const hit = hitRef.current;
    if (!hit || rowsProp != null || colsProp != null) return;

    const measure = () => {
      setGrid({
        cols: Math.max(1, Math.ceil(hit.clientWidth / cellSize)),
        rows: Math.max(1, Math.ceil(hit.clientHeight / cellSize)),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(hit);
    return () => observer.disconnect();
  }, [cellSize, colsProp, rowsProp]);

  useLayoutEffect(() => {
    if (rippleKey === 0) return;
    const frame = requestAnimationFrame(() => setRippling(true));
    return () => cancelAnimationFrame(frame);
  }, [rippleKey]);

  const cellFromPoint = (clientX: number, clientY: number): Cell | null => {
    const hit = hitRef.current;
    if (!hit) return null;
    const rect = hit.getBoundingClientRect();
    const col = Math.floor((clientX - rect.left) / cellSize);
    const row = Math.floor((clientY - rect.top) / cellSize);
    if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) return null;
    return { row, col };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    setHoveredCell(cellFromPoint(event.clientX, event.clientY));
  };

  return (
    <>
      <div className="rocket-exhibit-space" aria-hidden="true">
        <DivGrid
          rows={grid.rows}
          cols={grid.cols}
          cellSize={cellSize}
          borderColor="var(--cell-border-color)"
          fillColor="var(--cell-fill-color)"
          clickedCell={rippling ? clickedCell : null}
          hoveredCell={hoveredCell}
        />
      </div>
      <div
        ref={hitRef}
        className="rocket-exhibit-ripple-hit"
        aria-hidden="true"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoveredCell(null)}
        onPointerDown={(event) => {
          const cell = cellFromPoint(event.clientX, event.clientY);
          if (!cell) return;
          setRippling(false);
          setClickedCell(cell);
          setRippleKey((key) => key + 1);
        }}
      />
    </>
  );
};

type DivGridProps = {
  rows: number;
  cols: number;
  cellSize: number;
  borderColor: string;
  fillColor: string;
  clickedCell: Cell | null;
  hoveredCell: Cell | null;
};

type CellStyle = React.CSSProperties & {
  ['--delay']?: string;
  ['--duration']?: string;
};

const DivGrid = ({
  rows,
  cols,
  cellSize,
  borderColor,
  fillColor,
  clickedCell,
  hoveredCell,
}: DivGridProps) => {
  const cells = useMemo(
    () => Array.from({ length: rows * cols }, (_, idx) => idx),
    [rows, cols],
  );

  return (
    <div
      className={cn(
        'h-full w-full overflow-hidden',
        '[--cell-border-color:var(--color-neutral-300)] [--cell-fill-color:var(--color-neutral-100)] [--cell-shadow-color:var(--color-neutral-500)]',
        'dark:[--cell-border-color:var(--color-neutral-700)] dark:[--cell-fill-color:var(--color-neutral-900)] dark:[--cell-shadow-color:var(--color-neutral-800)]',
      )}
    >
      <div
        className="relative"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
          width: cols * cellSize,
          height: rows * cellSize,
        }}
      >
        {cells.map((idx) => {
          const rowIdx = Math.floor(idx / cols);
          const colIdx = idx % cols;
          const distance = clickedCell
            ? Math.hypot(clickedCell.row - rowIdx, clickedCell.col - colIdx)
            : 0;
          const style: CellStyle = clickedCell
            ? {
                '--delay': `${String(Math.max(0, distance * 55))}ms`,
                '--duration': `${String(200 + distance * 80)}ms`,
              }
            : {};
          const hovered =
            hoveredCell?.row === rowIdx && hoveredCell.col === colIdx;

          return (
            <div
              key={idx}
              className={cn(
                'cell relative border-[0.5px] opacity-40 transition-opacity duration-150 will-change-transform dark:shadow-[0px_0px_40px_1px_var(--cell-shadow-color)_inset]',
                hovered && 'opacity-80',
                clickedCell && 'animate-cell-ripple [animation-fill-mode:none]',
              )}
              style={{
                backgroundColor: fillColor,
                borderColor: borderColor,
                ...style,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
