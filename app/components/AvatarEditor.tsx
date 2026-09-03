"use client";

import { ChangeEvent, PointerEvent, useRef, useState } from "react";
import { Crop, ImagePlus, Trash2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CropState = { x: number; y: number; zoom: number };

export default function AvatarEditor({
  avatar,
  crop,
  name,
  onChange,
  onRemove,
}: {
  avatar: string;
  crop: CropState;
  name: string;
  onChange: (avatar: string, crop: CropState) => void;
  onRemove: () => void;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [pending, setPending] = useState("");
  const [draft, setDraft] = useState<CropState>(crop);
  const drag = useRef<{ x: number; y: number; cropX: number; cropY: number } | null>(null);

  const openCrop = (src: string, nextCrop: CropState) => {
    setPending(src);
    setDraft(nextCrop);
    setCropOpen(true);
  };

  const loadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => openCrop(String(reader.result ?? ""), { x: 0, y: 0, zoom: 1 });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, y: event.clientY, cropX: draft.x, cropY: draft.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setDraft((current) => ({
      ...current,
      x: Math.max(-100, Math.min(100, drag.current!.cropX + (event.clientX - drag.current!.x) / bounds.width * 100)),
      y: Math.max(-100, Math.min(100, drag.current!.cropY + (event.clientY - drag.current!.y) / bounds.height * 100)),
    }));
  };

  const imageStyle = (value: CropState) => ({ transform: `scale(${value.zoom}) translate(${value.x / value.zoom}%, ${value.y / value.zoom}%)` });
  const setZoom = (zoom: number) => setDraft((current) => ({ ...current, zoom }));

  return <div className="avatar-frame">
    <button className="avatar-button" disabled={!avatar} onClick={() => setViewerOpen(true)}>
      {avatar ? <span className="avatar-viewport"><img src={avatar} alt="Портрет персонажа" style={imageStyle(crop)} /></span> : <ImagePlus />}
      <span>{avatar ? "Увеличить" : "Нет портрета"}</span>
    </button>
    {avatar ? <div className="avatar-actions"><button onClick={() => setViewerOpen(true)}><ZoomIn /> Увеличить</button><button onClick={() => openCrop(avatar, crop)}><Crop /> Кадр</button></div> : <label className="avatar-upload"><ImagePlus /> Загрузить<input type="file" accept="image/*" onChange={loadFile} /></label>}

    <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
      <DialogContent className="avatar-dialog"><DialogHeader><DialogTitle>Портрет персонажа</DialogTitle><DialogDescription>{name}</DialogDescription></DialogHeader>{avatar && <img src={avatar} alt={`Портрет: ${name}`} />}<DialogFooter><Button className="negative-button" onClick={() => { onRemove(); setViewerOpen(false); }}><Trash2 /> Удалить</Button><label className="load-button"><ImagePlus /> Заменить<input type="file" accept="image/*" onChange={loadFile} /></label></DialogFooter></DialogContent>
    </Dialog>

    <Dialog open={cropOpen} onOpenChange={setCropOpen}>
      <DialogContent className="paper-dialog crop-dialog">
        <DialogHeader><DialogTitle>Выберите область мини-портрета</DialogTitle><DialogDescription>При масштабе 1 изображение видно целиком. Увеличьте его и перетащите лицо в квадратную рамку.</DialogDescription></DialogHeader>
        <div className="crop-stage" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          {pending && <img src={pending} alt="Предпросмотр мини-портрета" draggable={false} style={imageStyle(draft)} />}
          <div className="crop-grid" aria-hidden="true" />
        </div>
        <label className="crop-zoom"><ZoomIn /><span>Масштаб</span><input type="range" min="1" max="3" step="0.05" value={draft.zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
        <DialogFooter><Button className="negative-button" onClick={() => setCropOpen(false)}>Отмена</Button><Button onClick={() => { onChange(pending, draft); setCropOpen(false); setViewerOpen(false); }}>Сохранить кадр</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
