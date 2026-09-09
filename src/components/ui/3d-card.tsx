// Source: https://ui.aceternity.com/components/3d-card-effect  Adapted: 2026-09-08

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';

import { useMediaQuery } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';
import { FINE_POINTER_QUERY } from '@/lib/viewport';

type MouseEnterContextValue = [boolean, Dispatch<SetStateAction<boolean>>];

const MouseEnterContext = createContext<MouseEnterContextValue | undefined>(
  undefined,
);

const DEFAULT_HOVER_SCALE = 0.5;
const HoverScaleContext = createContext(DEFAULT_HOVER_SCALE);

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function cssLen(value: number | string, unit: string, scale = 1) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return typeof value === 'string' ? value : `0${unit}`;
  return `${n * scale}${unit}`;
}

type CardContainerProps = {
  children?: ReactNode;
  className?: string;
  containerClassName?: string;
  hoverScale?: number;
};

export function CardContainer({
  children,
  className,
  containerClassName,
  hoverScale = DEFAULT_HOVER_SCALE,
}: CardContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMouseEntered, setIsMouseEntered] = useState(false);
  // Touch reads the card flat. A tap fires emulated mouse events, so the tilt
  // would snap on and stay there, and the 3D layers sit on top of a scroller.
  const canTilt = useMediaQuery(FINE_POINTER_QUERY);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el || !canTilt || prefersReducedMotion()) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = ((event.clientX - left - width / 2) / 25) * hoverScale;
    const y = ((event.clientY - top - height / 2) / 25) * hoverScale;
    el.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
  };

  const handleMouseEnter = () => {
    if (!canTilt) return;
    setIsMouseEntered(true);
  };

  const handleMouseLeave = () => {
    setIsMouseEntered(false);
    const el = containerRef.current;
    if (!el) return;
    el.style.transform = 'rotateY(0deg) rotateX(0deg)';
  };

  return (
    <HoverScaleContext.Provider value={hoverScale}>
      <MouseEnterContext.Provider value={[isMouseEntered, setIsMouseEntered]}>
        <div
          className={cn(
            'flex items-center justify-center py-20',
            containerClassName,
          )}
          style={{ perspective: canTilt ? '1000px' : 'none' }}
        >
          <div
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={cn(
              'relative flex items-center justify-center transition-transform duration-200 ease-linear',
              className,
            )}
            style={{ transformStyle: canTilt ? 'preserve-3d' : 'flat' }}
          >
            {children}
          </div>
        </div>
      </MouseEnterContext.Provider>
    </HoverScaleContext.Provider>
  );
}

type CardBodyProps = {
  children: ReactNode;
  className?: string;
};

export function CardBody({ children, className }: CardBodyProps) {
  return (
    <div
      className={cn(
        'h-96 w-96 [transform-style:preserve-3d] [&>*]:[transform-style:preserve-3d]',
        className,
      )}
    >
      {children}
    </div>
  );
}

type CardItemTag = 'div' | 'p' | 'h2' | 'h3' | 'span';

type CardItemProps = {
  as?: CardItemTag;
  children?: ReactNode;
  className?: string;
  translateX?: number | string;
  translateY?: number | string;
  translateZ?: number | string;
  rotateX?: number | string;
  rotateY?: number | string;
  rotateZ?: number | string;
};

export function CardItem({
  as: Tag = 'div',
  children,
  className,
  translateX = 0,
  translateY = 0,
  translateZ = 0,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
}: CardItemProps) {
  const ref = useRef<HTMLElement>(null);
  const [isMouseEntered] = useMouseEnter();
  const hoverScale = useContext(HoverScaleContext);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isMouseEntered && !prefersReducedMotion()) {
      el.style.transform = `translateX(${cssLen(translateX, 'px', hoverScale)}) translateY(${cssLen(translateY, 'px', hoverScale)}) translateZ(${cssLen(translateZ, 'px', hoverScale)}) rotateX(${cssLen(rotateX, 'deg', hoverScale)}) rotateY(${cssLen(rotateY, 'deg', hoverScale)}) rotateZ(${cssLen(rotateZ, 'deg', hoverScale)})`;
      return;
    }
    el.style.transform =
      'translateX(0px) translateY(0px) translateZ(0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)';
  }, [
    hoverScale,
    isMouseEntered,
    translateX,
    translateY,
    translateZ,
    rotateX,
    rotateY,
    rotateZ,
  ]);

  return (
    <Tag
      // Polymorphic tag. Transform target is always an HTMLElement.
      ref={ref as never}
      className={cn(
        'w-fit transition-transform duration-200 ease-linear',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function useMouseEnter() {
  const context = useContext(MouseEnterContext);
  if (context === undefined) {
    throw new Error('useMouseEnter must be used within a CardContainer');
  }
  return context;
}
