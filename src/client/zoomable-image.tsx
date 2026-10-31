import { useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";

/** Shared photo surface: pointer gestures work for touch, pen and mouse. */
export function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const surface = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ distance: 0, x: 0, y: 0 });
  const clamp = (n: number) => Math.min(5, Math.max(1, n));
  const zoom = (delta: number) =>
    setView((v) => {
      const scale = clamp(v.scale + delta);
      const bounds = surface.current?.getBoundingClientRect();
      const limitX = ((bounds?.width || 0) * (scale - 1)) / 2;
      const limitY = ((bounds?.height || 0) * (scale - 1)) / 2;
      return {
        scale,
        x: Math.max(-limitX, Math.min(limitX, v.x)),
        y: Math.max(-limitY, Math.min(limitY, v.y)),
      };
    });
  const baseline = () => {
    const points = [...pointers.current.values()];
    const a = points[0],
      b = points[1] || a;
    gesture.current = a
      ? {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
        }
      : { distance: 0, x: 0, y: 0 };
  };
  return (
    <div className="photo-viewer">
      <div className="photo-zoom-controls" role="group" aria-label="Photo zoom">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={view.scale <= 1}
          onClick={() => zoom(-0.5)}
        >
          <Minus size={18} />
        </button>
        <output aria-live="polite">{Math.round(view.scale * 100)}%</output>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={view.scale >= 5}
          onClick={() => zoom(0.5)}
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          aria-label="Reset photo zoom"
          onClick={() => setView({ scale: 1, x: 0, y: 0 })}
        >
          <RotateCcw size={18} />
        </button>
      </div>
      <div
        ref={surface}
        className="photo-zoom-surface"
        aria-label="Pinch to zoom, drag to move photo"
        onDoubleClick={() =>
          setView((v) => ({ scale: v.scale > 1 ? 1 : 2, x: 0, y: 0 }))
        }
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          baseline();
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          const previous = gesture.current;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          baseline();
          const next = gesture.current;
          const bounds = e.currentTarget.getBoundingClientRect();
          setView((v) => {
            const scale = clamp(
              previous.distance > 0 && next.distance > 0
                ? (v.scale * next.distance) / previous.distance
                : v.scale,
            );
            const limitX = (bounds.width * (scale - 1)) / 2,
              limitY = (bounds.height * (scale - 1)) / 2;
            return {
              scale,
              x: Math.max(-limitX, Math.min(limitX, v.x + next.x - previous.x)),
              y: Math.max(-limitY, Math.min(limitY, v.y + next.y - previous.y)),
            };
          });
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          baseline();
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          baseline();
        }}
        onLostPointerCapture={(e) => {
          pointers.current.delete(e.pointerId);
          baseline();
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        />
      </div>
      <p className="photo-zoom-hint">
        Pinch or use + / − to zoom · Drag to move
      </p>
    </div>
  );
}
