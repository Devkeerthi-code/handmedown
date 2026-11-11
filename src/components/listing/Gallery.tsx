"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Category } from "@/generated/prisma/enums";
import { Icon } from "@/components/Icon";
import { Illustration } from "@/components/Illustration";
import { categoryOf } from "@/lib/catalog";
import { PRESETS, rubberBand, Spring, VelocityTracker } from "@/lib/physics";
import { photoUrl } from "@/lib/photos";
import type { PhotoRef } from "@/lib/listings/queries";

type Props = { photos: PhotoRef[]; category: Category; title: string; tint: string; overlay?: ReactNode };

/**
 * Swipe through photos like a stack of prints: 1:1 drag, momentum carries a
 * short flick to the next photo, rubber band past the ends, spring snap.
 * Arrows, dots, thumbnails and ←/→ keys do the same for everyone else.
 */
export function Gallery({ photos, category, title, tint, overlay }: Props) {
  const count = Math.max(1, photos.length);
  const [index, setIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const springRef = useRef<Spring | null>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    let x = 0;
    const spring = new Spring(0, PRESETS.snap, (v) => {
      x = v;
      track.style.transform = `translate3d(${v}px,0,0)`;
    });
    springRef.current = spring;
    const width = () => viewport.clientWidth;

    const vel = new VelocityTracker();
    let startX = 0;
    let startY = 0;
    let base = 0;
    let dragging = false;
    let decided = false;

    const down = (e: PointerEvent) => {
      if (count < 2 || (e.target as HTMLElement).closest("button")) return;
      dragging = true;
      decided = false;
      startX = e.clientX;
      startY = e.clientY;
      base = x;
      vel.reset();
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!decided) {
        if (Math.abs(dx) < 6 && Math.abs(e.clientY - startY) < 6) return;
        decided = true;
        // Mostly vertical: let the page scroll instead.
        if (Math.abs(e.clientY - startY) > Math.abs(dx)) {
          dragging = false;
          return;
        }
        viewport.setPointerCapture(e.pointerId);
      }
      vel.add(e.clientX);
      const min = -(count - 1) * width();
      let next = base + dx;
      if (next > 0) next = rubberBand(next, width());
      else if (next < min) next = min + rubberBand(next - min, width());
      spring.jump(next);
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      const v = vel.get();
      const projected = x + v * 220; // where momentum would carry it
      let target = Math.round(-projected / width());
      const current = indexRef.current;
      target = Math.max(current - 1, Math.min(current + 1, target)); // one photo per flick
      target = Math.max(0, Math.min(count - 1, target));
      indexRef.current = target;
      setIndex(target);
      spring.set(-target * width(), v * 1000);
    };
    const resize = () => spring.jump(-indexRef.current * width());

    viewport.addEventListener("pointerdown", down);
    viewport.addEventListener("pointermove", move);
    viewport.addEventListener("pointerup", up);
    viewport.addEventListener("pointercancel", up);
    window.addEventListener("resize", resize);
    return () => {
      spring.stop();
      viewport.removeEventListener("pointerdown", down);
      viewport.removeEventListener("pointermove", move);
      viewport.removeEventListener("pointerup", up);
      viewport.removeEventListener("pointercancel", up);
      window.removeEventListener("resize", resize);
    };
  }, [count]);

  const go = (i: number) => {
    const target = Math.max(0, Math.min(count - 1, i));
    indexRef.current = target;
    setIndex(target);
    springRef.current?.set(-target * (viewportRef.current?.clientWidth ?? 0));
  };

  return (
    <div>
      <div
        ref={viewportRef}
        className="gallery"
        role="region"
        aria-roledescription="carousel"
        aria-label={`Photos of ${title}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(index - 1);
          if (e.key === "ArrowRight") go(index + 1);
        }}
        style={{ background: `var(--${tint})` }}
      >
        <div ref={trackRef} className="gallery__track">
          {photos.length === 0 ? (
            <div className="gallery__slide">
              <Illustration name={categoryOf(category).art} />
            </div>
          ) : (
            photos.map((p, i) => (
              <div
                key={p.path}
                className="gallery__slide gallery__slide--photo"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${photos.length}`}
              >
                <Image
                  src={photoUrl(p.path)}
                  alt={i === 0 ? title : `${title}, photo ${i + 1}`}
                  width={p.width}
                  height={p.height}
                  priority={i === 0}
                  unoptimized
                  draggable={false}
                />
              </div>
            ))
          )}
        </div>
        {overlay}
        {count > 1 ? (
          <>
            <span className="badge badge--book gallery__count">
              {index + 1} / {count}
            </span>
            <button className="gallery__nav gallery__nav--prev" type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous photo">
              <Icon name="left" />
            </button>
            <button className="gallery__nav gallery__nav--next" type="button" onClick={() => go(index + 1)} disabled={index === count - 1} aria-label="Next photo">
              <Icon name="right" />
            </button>
            <div className="gallery__dots">
              {photos.map((p, i) => (
                <button key={p.path} type="button" onClick={() => go(i)} aria-current={i === index} aria-label={`Show photo ${i + 1}`}>
                  <span />
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <div className="thumbs">
          {photos.map((p, i) => (
            <button key={p.path} type="button" onClick={() => go(i)} aria-current={i === index} aria-label={`Show photo ${i + 1}`} style={{ padding: 0 }}>
              <Image src={photoUrl(p.path, "thumb")} alt="" width={72} height={64} unoptimized />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
