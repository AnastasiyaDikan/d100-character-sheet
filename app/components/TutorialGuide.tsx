"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type TutorialStep = readonly [string, string, string];

export default function TutorialGuide({
  tutorial,
  step,
  total,
  onStepChange,
  onClose,
}: {
  tutorial: TutorialStep;
  step: number;
  total: number;
  onStepChange: (step: number) => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const update = () => {
      const target = document.querySelector(`[data-tutorial="${tutorial[0]}"]`);
      setRect(target?.getBoundingClientRect() ?? null);
    };
    const timer = window.setTimeout(update, 320);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [tutorial]);

  const pad = 8;
  const viewportWidth = typeof window === "undefined" ? 1920 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 1080 : window.innerHeight;
  const top = Math.max(0, (rect?.top ?? 0) - pad);
  const left = Math.max(0, (rect?.left ?? 0) - pad);
  const right = Math.min(viewportWidth, (rect?.right ?? viewportWidth) + pad);
  const bottom = Math.min(viewportHeight, (rect?.bottom ?? viewportHeight) + pad);

  return <div className="tutorial-overlay" aria-live="polite">
    {rect && <>
      <div className="tutorial-shade shade-top" style={{ height: top }} />
      <div className="tutorial-shade shade-left" style={{ top, width: left, height: Math.max(0, bottom - top) }} />
      <div className="tutorial-shade shade-right" style={{ top, left: right, height: Math.max(0, bottom - top) }} />
      <div className="tutorial-shade shade-bottom" style={{ top: bottom }} />
      <div className="tutorial-highlight" style={{ top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }} />
    </>}
    <aside className={`tutorial-card ${rect && rect.left > viewportWidth / 2 ? "place-left" : "place-right"}`}>
      <span>Шаг {step + 1} из {total}</span>
      <h2>{tutorial[1]}</h2>
      {tutorial[0] === "talents" ? <p>
        Здесь можно внести <a href="https://ffg.fandom.com/ru/wiki/Таланты#.D0.93.D1.80.D1.83.D0.BF.D0.BF.D1.8B" target="_blank" rel="noreferrer">Таланты и черты</a> персонажа с сайта (свойства некоторых талантов необходимо согласовывать с Мастером). Они могут браться либо с сайта, либо добавляться самостоятельно
      </p> : <p>{tutorial[2]}</p>}
      <div>
        <Button className="negative-button" onClick={onClose}>Пропустить</Button>
        <Button className="negative-button" disabled={step === 0} onClick={() => onStepChange(Math.max(0, step - 1))}>Назад</Button>
        <Button onClick={() => step === total - 1 ? onClose() : onStepChange(step + 1)}>{step === total - 1 ? "Готово" : "Далее"}</Button>
      </div>
    </aside>
  </div>;
}
