"use client";

import { ClipboardEvent, useEffect, useState } from "react";
import { IconBrush, IconClose } from "@/components/icons";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/compress-image";
import type { TaskImage } from "@/lib/types";

const MAX_IMAGES = 12;

export type DraftImage = { id?: string; data: string };

async function readImages(files: File[]) {
  const images = files.filter((file) => file.type.startsWith("image/"));
  const compressed = await Promise.all(images.map((file) => compressImage(file)));
  return compressed.map((item) => item.base64);
}

function ImageStrip({
  images,
  onOpen,
  onRemove,
}: {
  images: DraftImage[];
  onOpen: (data: string) => void;
  onRemove?: (index: number) => void;
}) {
  if (!images.length) return null;
  return (
    <ul className="desc-images">
      {images.map((image, index) => (
        <li key={image.id ?? `new-${index}`}>
          <button type="button" className="desc-thumb" onClick={() => onOpen(image.data)} aria-label="Ampliar imagem">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.data} alt="" />
          </button>
          {onRemove ? (
            <button type="button" className="desc-remove" onClick={() => onRemove(index)} aria-label="Remover imagem">
              <IconClose width={12} height={12} />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src, onClose]);
  if (!src) return null;
  return (
    <button type="button" className="desc-lightbox" onClick={onClose} aria-label="Fechar imagem">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
    </button>
  );
}

export function DescriptionFields({
  text,
  images,
  onText,
  onImages,
  autoFocus,
}: {
  text: string;
  images: DraftImage[];
  onText: (value: string) => void;
  onImages: (next: DraftImage[]) => void;
  autoFocus?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function addFiles(files: File[]) {
    setError("");
    try {
      const added = await readImages(files);
      if (!added.length) return;
      if (images.length + added.length > MAX_IMAGES) {
        setError(`No máximo ${MAX_IMAGES} imagens.`);
        return;
      }
      onImages([...images, ...added.map((data) => ({ data }))]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não deu para ler a imagem.");
    }
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    event.preventDefault();
    void addFiles(files);
  }

  return (
    <div className="desc-fields">
      <textarea
        rows={5}
        value={text}
        autoFocus={autoFocus}
        onChange={(event) => onText(event.target.value)}
        onPaste={onPaste}
        placeholder="Contexto, critério de pronto, bloqueio… (cola imagem com Ctrl+V)"
      />
      <ImageStrip
        images={images}
        onOpen={setPreview}
        onRemove={(index) => onImages(images.filter((_, position) => position !== index))}
      />
      <label className="btn-ghost desc-upload">
        + Imagem
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <Lightbox src={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

export function TaskDescription({ taskId, initialNotes }: { taskId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes);
  const [images, setImages] = useState<TaskImage[]>([]);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftImages, setDraftImages] = useState<DraftImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let alive = true;
    api<{ notes: string; images: TaskImage[] }>(`/api/tasks/description?taskId=${taskId}`)
      .then((data) => {
        if (!alive) return;
        setNotes(data.notes);
        setImages(data.images);
        setLoaded(true);
      })
      .catch((err) => {
        if (alive) setLoadError(err instanceof Error ? err.message : "Não carregou a descrição.");
      });
    return () => {
      alive = false;
    };
  }, [taskId]);

  // Só edita depois de carregar: o PUT apaga toda imagem que não vier em keepImageIds.
  function startEdit() {
    if (!loaded) return;
    setDraftText(notes);
    setDraftImages(images);
    setError("");
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const saved = await api<{ notes: string; images: TaskImage[] }>("/api/tasks/description", {
        method: "PUT",
        body: JSON.stringify({
          taskId,
          notes: draftText,
          keepImageIds: draftImages.flatMap((image) => (image.id ? [image.id] : [])),
          newImages: draftImages.flatMap((image) => (image.id ? [] : [image.data])),
        }),
      });
      setNotes(saved.notes);
      setImages(saved.images);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou a descrição.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="desc-block">
      <div className="desc-head">
        <span>Descrição</span>
        {editing || !loaded ? null : (
          <button type="button" className="icon-btn" onClick={startEdit} aria-label="Editar descrição" title="Editar descrição">
            <IconBrush width={15} height={15} />
          </button>
        )}
      </div>
      {editing ? (
        <>
          <DescriptionFields
            text={draftText}
            images={draftImages}
            onText={setDraftText}
            onImages={setDraftImages}
            autoFocus
          />
          {error ? <p className="form-error">{error}</p> : null}
          <div className="desc-actions">
            <button type="button" className="btn-ink" disabled={busy} onClick={() => void save()}>
              {busy ? "Salvando…" : "Salvar descrição"}
            </button>
            <button type="button" className="text-btn" disabled={busy} onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <div
          className="desc-view"
          onDoubleClick={(event) => {
            if ((event.target as HTMLElement).closest(".desc-thumb")) return;
            startEdit();
          }}
          title={loaded ? "Dois cliques para editar" : undefined}
        >
          {loadError ? (
            <p className="form-error">{loadError}</p>
          ) : notes || images.length ? (
            <>
              {notes ? <p className="desc-text">{notes}</p> : null}
              <ImageStrip images={images} onOpen={setPreview} />
            </>
          ) : (
            <p className="empty-col">Sem descrição. Clica no pincel ou dá 2 cliques aqui.</p>
          )}
        </div>
      )}
      <Lightbox src={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
