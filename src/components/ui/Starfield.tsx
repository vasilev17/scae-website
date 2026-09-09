import { useEffect, useRef, type RefObject } from 'react';

export type StarfieldWarp = {
  speed: number;
  zoom: number;
};

interface StarfieldProps {
  bgColor?: string;
  starColor?: string;
  speed?: number;
  quantity?: number;
  warpRef?: RefObject<StarfieldWarp>;
  warpReactive?: boolean;
  running?: boolean;
  frozen?: boolean;
}

type StarTuple = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  boolean,
];

interface StarfieldData {
  w: number;
  h: number;
  ctx: CanvasRenderingContext2D | null;
  x: number;
  y: number;
  z: number;
  star: {
    colorRatio: number;
    arr: StarTuple[];
  };
}

type LoopControls = {
  start: () => void;
  stop: () => void;
};

export function Starfield({
  bgColor = 'rgba(0, 0, 0, 1)',
  starColor = 'rgba(255, 255, 255, 1)',
  speed = 0.5,
  quantity = 500,
  warpRef,
  warpReactive = true,
  running = true,
  frozen = false,
}: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const runningRef = useRef(running);
  const loopRef = useRef<LoopControls | null>(null);

  const sd = useRef<StarfieldData>({
    w: 0,
    h: 0,
    ctx: null,
    x: 0,
    y: 0,
    z: 0,
    star: { colorRatio: 0, arr: [] },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const div = canvas.parentElement;
    const still =
      frozen || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const measureViewport = () => {
      if (div) {
        sd.current.w = div.clientWidth;
        sd.current.h = div.clientHeight;

        canvas.width = sd.current.w;
        canvas.height = sd.current.h;

        sd.current.x = Math.round(sd.current.w / 2);
        sd.current.y = Math.round(sd.current.h / 2);

        sd.current.z = (sd.current.w + sd.current.h) / 2;
        sd.current.star.colorRatio = 1 / sd.current.z;

        if (sd.current.ctx) {
          sd.current.ctx.fillStyle = bgColor;
          sd.current.ctx.strokeStyle = starColor;
        }
      }
    };

    const initStars = () => {
      if (sd.current.star.arr.length !== quantity) {
        sd.current.star.arr = new Array(quantity)
          .fill(null)
          .map(() => [
            Math.random() * sd.current.w * 2 - sd.current.x * 2,
            Math.random() * sd.current.h * 2 - sd.current.y * 2,
            Math.round(Math.random() * sd.current.z),
            0,
            0,
            0,
            0,
            true,
          ]);
      }
    };

    const step = (travel: number, ratio: number) => {
      sd.current.star.arr = sd.current.star.arr.map((star) => {
        const newStar = [...star] as StarTuple;
        newStar[7] = true;

        newStar[5] = newStar[3];
        newStar[6] = newStar[4];

        newStar[2] -= travel;

        if (newStar[2] > sd.current.z) {
          newStar[2] -= sd.current.z;
          newStar[7] = false;
        }
        if (newStar[2] < 0) {
          newStar[2] += sd.current.z;
          newStar[7] = false;
        }

        newStar[3] = sd.current.x + (newStar[0] / newStar[2]) * ratio;
        newStar[4] = sd.current.y + (newStar[1] / newStar[2]) * ratio;

        return newStar;
      });
    };

    const FRAME_MS = 1000 / 60;
    const MAX_CATCHUP = 4;
    let pending = 0;
    let lastTick = 0;

    const update = (now: number) => {
      if (warpReactive) {
        const warp = warpRef?.current;
        step(speed * (warp?.speed ?? 1), (quantity / 2) * (warp?.zoom ?? 1));
        return;
      }

      const ratio = quantity / 2;
      pending += lastTick ? now - lastTick : FRAME_MS;
      lastTick = now;
      pending = Math.min(pending, FRAME_MS * MAX_CATCHUP);

      while (pending >= FRAME_MS) {
        step(speed, ratio);
        pending -= FRAME_MS;
      }
    };

    const draw = () => {
      const ctx = sd.current.ctx;
      if (!ctx) return;

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, sd.current.w, sd.current.h);
      ctx.strokeStyle = starColor;

      sd.current.star.arr.forEach((star) => {
        if (
          star[5] > 0 &&
          star[5] < sd.current.w &&
          star[6] > 0 &&
          star[6] < sd.current.h &&
          star[7]
        ) {
          ctx.lineWidth = (1 - sd.current.star.colorRatio * star[2]) * 2;

          ctx.beginPath();
          ctx.moveTo(star[5], star[6]);
          ctx.lineTo(star[3], star[4]);
          ctx.stroke();
          ctx.closePath();
        }
      });
    };

    const loop = (now: number) => {
      update(now);
      draw();
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    const stop = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // A resumed fixed-step field must not replay the whole pause at once.
      lastTick = 0;
      pending = 0;
    };

    const start = () => {
      if (still || animationFrameRef.current) return;
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    sd.current.ctx = canvas.getContext('2d');
    measureViewport();
    initStars();

    if (still) {
      step(speed, (quantity / 2) * (warpRef?.current.zoom ?? 1));
      draw();
    } else if (runningRef.current) {
      start();
    }
    loopRef.current = { start, stop };

    const handleResize = () => {
      const oldW = sd.current.w;
      const oldH = sd.current.h;
      const oldZ = sd.current.z;

      measureViewport();

      if (oldW === 0 || oldH === 0 || oldZ === 0) return;
      const scaleX = sd.current.w / oldW;
      const scaleY = sd.current.h / oldH;
      const scaleZ = sd.current.z / oldZ;

      const ratio =
        (quantity / 2) * (warpReactive ? (warpRef?.current.zoom ?? 1) : 1);
      sd.current.star.arr.forEach((star) => {
        star[0] *= scaleX;
        star[1] *= scaleY;
        star[2] *= scaleZ;

        star[3] = sd.current.x + (star[0] / star[2]) * ratio;
        star[4] = sd.current.y + (star[1] / star[2]) * ratio;
      });

      if (still) {
        draw();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      stop();
      loopRef.current = null;
      window.removeEventListener('resize', handleResize);
    };
  }, [bgColor, starColor, speed, quantity, warpRef, warpReactive, frozen]);

  useEffect(() => {
    runningRef.current = running;
    if (running) loopRef.current?.start();
    else loopRef.current?.stop();
  }, [running]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
