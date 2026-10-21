// src/workspaces/exportOutput.tsx
import { renderToStaticMarkup } from "react-dom/server";

// src/donors/teajia/conversation/ConversationCanvas.tsx
import React4, { createContext as createContext2, useContext as useContext2 } from "react";

// src/donors/wordforge/passage-links.mjs
function safePassageHref(value) {
  if (typeof value !== "string" || !value || /[\s\\\u0000-\u001f\u007f<>]/u.test(value)) return false;
  if (value.startsWith("#")) return true;
  if (value.startsWith("/")) return !value.startsWith("//");
  if (/^https?:/i.test(value)) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !!url.hostname;
    } catch {
      return false;
    }
  }
  return /^(mailto|tel):[^:]/i.test(value);
}

// src/workspaces/AcceptedProse.tsx
import React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var sourceProps = (attrs = {}) => ({ "data-passage-id": attrs.passageId || void 0, "data-source-ref": attrs.sourceRef || void 0, "data-source-title": attrs.sourceTitle || void 0 });
var safeHref = (value) => safePassageHref(value) ? value : void 0;
function renderNode(node, key) {
  if (node.type === "text") {
    let words = node.text || "";
    for (const [index, mark] of (node.marks || []).entries()) {
      const attrs = mark.attrs || {}, props = { key: key + "m" + index };
      switch (mark.type) {
        case "bold":
          words = /* @__PURE__ */ jsx("strong", { ...props, children: words });
          break;
        case "italic":
          words = /* @__PURE__ */ jsx("em", { ...props, children: words });
          break;
        case "code":
          words = /* @__PURE__ */ jsx("code", { ...props, children: words });
          break;
        case "strike":
          words = /* @__PURE__ */ jsx("s", { ...props, children: words });
          break;
        case "link": {
          const href = safeHref(attrs.href);
          words = href ? /* @__PURE__ */ jsx("a", { ...props, href, title: typeof attrs.title === "string" ? attrs.title : void 0, children: words }) : words;
          break;
        }
        case "inlineQuote":
          words = /* @__PURE__ */ jsx("q", { ...props, ...sourceProps(attrs), children: words });
          break;
        case "sourced":
          words = /* @__PURE__ */ jsx("span", { ...props, ...sourceProps(attrs), className: "ar-recorded-sourced", children: words });
          break;
        case "paraphrase":
          words = /* @__PURE__ */ jsxs("span", { ...props, ...sourceProps(attrs), className: "ar-recorded-paraphrase", children: [
            /* @__PURE__ */ jsx("span", { className: "ar-recorded-flag", children: "Paraphrase \xB7 review required: " }),
            words
          ] });
          break;
      }
    }
    return /* @__PURE__ */ jsx(React.Fragment, { children: words }, key);
  }
  const children = (node.content || []).map((child, index) => renderNode(child, key + "-" + index));
  switch (node.type) {
    case "doc":
      return /* @__PURE__ */ jsx(React.Fragment, { children }, key);
    case "paragraph":
      return /* @__PURE__ */ jsx("p", { children }, key);
    case "heading": {
      const level = Math.max(1, Math.min(3, Number(node.attrs?.level) || 2));
      const Tag = "h" + level;
      return /* @__PURE__ */ jsx(Tag, { children }, key);
    }
    case "bulletList":
      return /* @__PURE__ */ jsx("ul", { children }, key);
    case "orderedList":
      return /* @__PURE__ */ jsx("ol", { start: Number.isInteger(node.attrs?.start) ? node.attrs?.start : void 0, children }, key);
    case "listItem":
      return /* @__PURE__ */ jsx("li", { children }, key);
    case "hardBreak":
      return /* @__PURE__ */ jsx("br", {}, key);
    case "horizontalRule":
      return /* @__PURE__ */ jsx("hr", {}, key);
    case "codeBlock":
      return /* @__PURE__ */ jsx("pre", { children: /* @__PURE__ */ jsx("code", { children }) }, key);
    case "blockquote":
      return /* @__PURE__ */ jsx("blockquote", { children }, key);
    case "blockquoteAttributed":
      return /* @__PURE__ */ jsxs("blockquote", { ...sourceProps(node.attrs), children: [
        /* @__PURE__ */ jsx("p", { children }),
        /* @__PURE__ */ jsxs("footer", { children: [
          "\u2014 ",
          node.attrs?.author || node.attrs?.sourceTitle || "Source"
        ] })
      ] }, key);
    case "referenceCard":
      return /* @__PURE__ */ jsxs("aside", { ...sourceProps(node.attrs), className: "ar-recorded-reference", children: [
        /* @__PURE__ */ jsxs("strong", { children: [
          "Reference \xB7 ",
          node.attrs?.sourceTitle || "Source"
        ] }),
        /* @__PURE__ */ jsx("p", { children: node.attrs?.text || "" })
      ] }, key);
    default:
      return /* @__PURE__ */ jsx(React.Fragment, { children }, key);
  }
}
function AcceptedProse({ document: document2, paragraphId }) {
  return /* @__PURE__ */ jsx("div", { className: "ar-recorded-prose", "data-paragraph-id": paragraphId, children: renderNode(document2, paragraphId) });
}

// src/donors/teajia/EditablePhoto.tsx
import { useCallback as useCallback2, useEffect as useEffect2, useRef as useRef2, useState } from "react";

// src/donors/teajia/storyEdit.tsx
import { createContext, useContext, useMemo, useCallback, useEffect, useRef } from "react";

// src/workspaces/media.ts
var localMediaApi = {
  async uploadImageProgress(file, onProgress, _options) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG or WebP photo.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Choose a photo smaller than 5 MB.");
    onProgress(0.1);
    const response = await fetch("/api/media", { method: "POST", headers: { "Content-Type": file.type, "X-Filename": encodeURIComponent(file.name) }, body: file });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save photo.");
    onProgress(1);
    return result.url;
  }
};

// src/donors/teajia/storyEdit.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
var Ctx = createContext({ mediaApi: localMediaApi, isOwner: false, editing: false, previewVisitor: true, photos: {}, setPhoto: () => {
}, text: (_f, t) => t, setText: () => {
}, registerFrame: () => {
}, usedImages: [] });
var useStoryEdit = () => useContext(Ctx);
var registerFrame = () => {
};
function LocalStoryProvider({ placements, editing, onPlacements, children, libraryImages = [], mediaApi = localMediaApi }) {
  const alive = useRef(true), callback = useRef(onPlacements);
  callback.current = onPlacements;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const setPhoto = useCallback((slot, p) => {
    if (!alive.current) return;
    callback.current((rows) => {
      const previous = rows.find((row) => row.slot === slot);
      if (!previous) return rows;
      return p ? rows.map((row) => row.slot === slot ? { ...row, url: p.url, x: p.crop.x, y: p.crop.y, zoom: p.crop.scale } : row) : rows.filter((row) => row.slot !== slot);
    });
  }, []);
  const value = useMemo(() => ({ mediaApi, isOwner: true, editing, previewVisitor: !editing, photos: Object.fromEntries(placements.filter((p) => p.url).map((p) => [p.slot, { url: p.url, crop: { x: p.x, y: p.y, scale: p.zoom } }])), setPhoto, text: (_f, t) => t, setText: () => {
  }, registerFrame, usedImages: [.../* @__PURE__ */ new Set([...placements.filter((p) => p.url).map((p) => p.url), ...libraryImages])] }), [placements, editing, setPhoto, libraryImages, mediaApi]);
  return /* @__PURE__ */ jsx2(Ctx.Provider, { value, children });
}
function EditableText({ children, as = "p", className, style }) {
  const Tag = as;
  return /* @__PURE__ */ jsx2(Tag, { className, style, children });
}

// src/donors/teajia/imageUtils.ts
async function shrinkImage(file, maxEdge = 2e3, quality = 0.85) {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    if (longest <= maxEdge) {
      bitmap.close?.();
      return file;
    }
    const scale = maxEdge / longest;
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) return file;
    const name = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
function isTouch() {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
}

// src/donors/teajia/EditablePhoto.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var DEFAULT_CROP = { scale: 1, x: 0.5, y: 0.5 };
var TOUCH = isTouch();
var EditablePhoto = ({
  slot,
  alt,
  label,
  caption,
  captionField,
  aspect = "4/5",
  fill = false,
  placeholderBg = "linear-gradient(160deg,var(--tj-read-empty-from),var(--tj-read-plate-to))",
  placeholder,
  defaultPhoto,
  bare = false
}) => {
  const { mediaApi, isOwner, editing, previewVisitor, photos, setPhoto, text, setText, registerFrame: registerFrame2, usedImages } = useStoryEdit();
  const liveEdit = isOwner && editing && !previewVisitor;
  const photo = photos[slot] ?? (defaultPhoto?.url ? { url: defaultPhoto.url, crop: { scale: 1, x: defaultPhoto.x ?? 0.5, y: defaultPhoto.y ?? 0.5 } } : void 0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState(false);
  const [lastFile, setLastFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [focusing, setFocusing] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const frameRef = useRef2(null);
  const pinchRef = useRef2(null);
  useEffect2(() => {
    if (isOwner) registerFrame2(slot, label || alt || slot);
  }, [isOwner, slot, label, alt, registerFrame2]);
  const objPos = (c) => `${(c.x * 100).toFixed(1)}% ${(c.y * 100).toFixed(1)}%`;
  const upload = useCallback2(async (file) => {
    if (!file.type.startsWith("image/")) return;
    setLastFile(file);
    setUploadError(false);
    setBusy(true);
    setProgress(0.02);
    try {
      const small = await shrinkImage(file);
      const url = await mediaApi.uploadImageProgress(small, (p) => setProgress(Math.max(0.05, p)), { filename: small.name || "photo.jpg" });
      setPhoto(slot, { url, crop: { ...DEFAULT_CROP } });
      setProgress(1);
    } catch {
      setUploadError(true);
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 600);
    }
  }, [slot, setPhoto, mediaApi]);
  const retryUpload = useCallback2(() => {
    if (lastFile) upload(lastFile);
  }, [lastFile, upload]);
  const onDrop = useCallback2((e) => {
    e.preventDefault();
    setDragOver(false);
    if (!liveEdit) return;
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }, [liveEdit, upload]);
  const onPaste = useCallback2((e) => {
    if (!liveEdit) return;
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        upload(file);
      }
    }
  }, [liveEdit, upload]);
  const moveFocal = useCallback2((clientX, clientY) => {
    if (!photo || !frameRef.current) return;
    const r = frameRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    setPhoto(slot, { ...photo, crop: { ...photo.crop, x, y } });
  }, [photo, slot, setPhoto]);
  const setScale = (scale) => {
    if (!photo) return;
    setPhoto(slot, { ...photo, crop: { ...photo.crop, scale: Math.min(3, Math.max(1, scale)) } });
  };
  const tapFocal = useCallback2((e) => {
    if (!liveEdit || !photo || pinchRef.current) return;
    if (e.target.dataset.focalDot) return;
    moveFocal(e.clientX, e.clientY);
  }, [liveEdit, photo, moveFocal]);
  const onTouchStart = useCallback2((e) => {
    if (!liveEdit || !photo || e.touches.length !== 2) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    pinchRef.current = { startDist: dist, startScale: photo.crop.scale };
  }, [liveEdit, photo]);
  const onTouchMove = useCallback2((e) => {
    if (!pinchRef.current || e.touches.length !== 2 || !photo) return;
    e.preventDefault();
    const [a, b] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const next = pinchRef.current.startScale * (dist / pinchRef.current.startDist);
    setScale(next);
  }, [photo]);
  const onTouchEnd = useCallback2(() => {
    pinchRef.current = null;
  }, []);
  useEffect2(() => {
    if (!focusing) return;
    const mv = (e) => moveFocal(e.clientX, e.clientY);
    const up = () => setFocusing(false);
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
    };
  }, [focusing, moveFocal]);
  const captionText = captionField ? text(captionField, caption || "") : caption;
  return /* @__PURE__ */ jsxs2("figure", { style: fill ? { margin: 0, position: "absolute", inset: 0 } : { margin: 0 }, children: [
    /* @__PURE__ */ jsxs2(
      "div",
      {
        ref: frameRef,
        "data-frame-slot": slot,
        tabIndex: liveEdit ? 0 : -1,
        onPaste,
        onPointerUp: tapFocal,
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        onDragOver: (e) => {
          if (!liveEdit) return;
          e.preventDefault();
          setDragOver(true);
        },
        onDragLeave: () => setDragOver(false),
        onDrop,
        style: {
          position: fill ? "absolute" : "relative",
          inset: fill ? 0 : void 0,
          aspectRatio: fill ? void 0 : aspect,
          border: fill || bare && photo && !liveEdit ? "none" : `1px solid ${dragOver ? "rgb(var(--tj-read-gold-rgb) / 0.7)" : liveEdit ? "rgb(var(--tj-read-gold-rgb) / 0.4)" : "rgb(var(--tj-read-gold-rgb) / 0.2)"}`,
          borderRadius: fill || bare ? 0 : 3,
          overflow: "hidden",
          background: photo ? "var(--tj-read-bg)" : placeholderBg,
          outline: "none",
          touchAction: liveEdit && photo ? "none" : "auto"
        },
        children: [
          photo ? /* @__PURE__ */ jsx3(
            "img",
            {
              src: photo.url,
              alt,
              loading: "lazy",
              draggable: false,
              style: {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: objPos(photo.crop),
                transform: `scale(${photo.crop.scale})`,
                transformOrigin: objPos(photo.crop),
                userSelect: "none"
              }
            }
          ) : placeholder ?? null,
          label && !liveEdit && /* @__PURE__ */ jsx3("div", { style: { position: "absolute", left: 14, bottom: 12, fontFamily: "var(--font-sans)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--tj-gold, var(--tj-read-gold-default))" }, children: label }),
          liveEdit && photo && /* @__PURE__ */ jsx3(
            "div",
            {
              "data-focal-dot": "1",
              role: "slider",
              tabIndex: 0,
              "aria-label": "Photograph focal point",
              "aria-valuetext": `Horizontal ${Math.round(photo.crop.x * 100)}%, vertical ${Math.round(photo.crop.y * 100)}%`,
              onKeyDown: (event) => {
                const steps = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] };
                const step = steps[event.key];
                if (!step) return;
                event.preventDefault();
                setPhoto(slot, { ...photo, crop: { ...photo.crop, x: Math.max(0, Math.min(1, photo.crop.x + step[0])), y: Math.max(0, Math.min(1, photo.crop.y + step[1])) } });
              },
              onPointerDown: (e) => {
                e.preventDefault();
                e.stopPropagation();
                setFocusing(true);
              },
              style: {
                position: "absolute",
                left: `${photo.crop.x * 100}%`,
                top: `${photo.crop.y * 100}%`,
                width: TOUCH ? 44 : 26,
                height: TOUCH ? 44 : 26,
                marginLeft: TOUCH ? -22 : -13,
                marginTop: TOUCH ? -22 : -13,
                borderRadius: "50%",
                border: "2px solid var(--tj-read-cream)",
                boxShadow: "0 0 0 2px rgb(var(--tj-read-bg-rgb) / 0.6), 0 0 8px rgba(0,0,0,0.5)",
                background: "rgb(var(--tj-read-gold-rgb) / 0.4)",
                cursor: "grab",
                touchAction: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              },
              title: "Drag or tap the photo to set the focal point",
              children: /* @__PURE__ */ jsx3("span", { "data-focal-dot": "1", style: { width: 6, height: 6, borderRadius: "50%", background: "var(--tj-read-cream)" } })
            }
          ),
          liveEdit && busy && /* @__PURE__ */ jsx3("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "rgb(var(--tj-read-gold-rgb) / 0.18)", zIndex: 6 }, children: /* @__PURE__ */ jsx3("div", { style: { height: "100%", width: `${Math.round(progress * 100)}%`, background: "var(--tj-gold, var(--tj-read-gold-default))", transition: "width 160ms" } }) }),
          liveEdit && uploadError && !busy && /* @__PURE__ */ jsx3(
            "button",
            {
              type: "button",
              onClick: retryUpload,
              style: { position: "absolute", inset: 0, zIndex: 7, background: "rgb(var(--tj-read-bg-rgb) / 0.85)", border: "none", color: "var(--tj-read-cream)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, letterSpacing: "0.08em" },
              children: "upload failed \xB7 tap to retry"
            }
          ),
          liveEdit && !busy && !uploadError && /* @__PURE__ */ jsx3("div", { style: { position: "absolute", top: 8, right: 8, fontFamily: "var(--font-sans)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--tj-read-taupe)", background: "rgb(var(--tj-read-bg-rgb) / 0.72)", padding: "4px 8px", borderRadius: 2, pointerEvents: "none" }, children: photo ? TOUCH ? "tap to set focus" : "drag focus \xB7 paste" : TOUCH ? "add a photo" : "drop / paste / pick" }),
          liveEdit && !photo && !showLibrary && /* @__PURE__ */ jsxs2("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 12 }, children: [
            TOUCH && /* @__PURE__ */ jsxs2("label", { role: "button", tabIndex: 0, "aria-label": "Choose a photograph", onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.currentTarget.querySelector("input[type=file]")?.click();
              }
            }, style: { minWidth: 160, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgb(var(--tj-read-gold-rgb) / 0.5)", borderRadius: 4, color: "var(--tj-read-cream)", background: "rgb(var(--tj-read-gold-rgb) / 0.18)", fontFamily: "var(--font-sans)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }, children: [
              "take a photo",
              /* @__PURE__ */ jsx3(
                "input",
                {
                  type: "file",
                  accept: "image/*",
                  capture: "environment",
                  style: { display: "none" },
                  onChange: (e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                  }
                }
              )
            ] }),
            /* @__PURE__ */ jsxs2("label", { role: "button", tabIndex: 0, "aria-label": "Choose a photograph", onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.currentTarget.querySelector("input[type=file]")?.click();
              }
            }, style: { minWidth: 160, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgb(var(--tj-read-gold-rgb) / 0.35)", borderRadius: 4, color: "var(--tj-read-taupe)", background: "rgb(var(--tj-read-bg-rgb) / 0.5)", fontFamily: "var(--font-sans)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }, children: [
              TOUCH ? "choose from photos" : "drop, paste, or choose",
              /* @__PURE__ */ jsx3(
                "input",
                {
                  type: "file",
                  accept: "image/*",
                  style: { display: "none" },
                  onChange: (e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                  }
                }
              )
            ] })
          ] }),
          liveEdit && !photo && usedImages.length > 0 && /* @__PURE__ */ jsx3(
            "button",
            {
              type: "button",
              onClick: () => setShowLibrary((s) => !s),
              style: { position: "absolute", bottom: 8, left: 8, zIndex: 3, fontFamily: "var(--font-sans)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--tj-read-taupe)", background: "rgb(var(--tj-read-bg-rgb) / 0.8)", border: "none", borderRadius: 2, padding: "4px 8px", cursor: "pointer" },
              children: showLibrary ? "close" : "reuse a photo"
            }
          ),
          liveEdit && !photo && showLibrary && /* @__PURE__ */ jsx3("div", { style: { position: "absolute", inset: 0, zIndex: 4, background: "rgb(var(--tj-read-bg-rgb) / 0.95)", padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(44px,1fr))", gap: 6, alignContent: "start", overflowY: "auto" }, children: usedImages.map((url) => /* @__PURE__ */ jsx3(
            "button",
            {
              type: "button",
              onClick: () => {
                setPhoto(slot, { url, crop: { ...DEFAULT_CROP } });
                setShowLibrary(false);
              },
              style: { aspectRatio: "1/1", border: "1px solid rgb(var(--tj-read-gold-rgb) / 0.3)", borderRadius: 2, padding: 0, overflow: "hidden", cursor: "pointer", background: "none" },
              children: /* @__PURE__ */ jsx3("img", { src: url, alt: "", style: { width: "100%", height: "100%", objectFit: "cover" } })
            },
            url
          )) })
        ]
      }
    ),
    liveEdit && photo && /* @__PURE__ */ jsxs2("div", { style: fill ? { position: "absolute", left: 16, right: 16, bottom: 16, zIndex: 5, padding: 10, border: "1px solid rgb(var(--tj-read-gold-rgb) / 0.3)", borderRadius: 4, background: "rgb(var(--tj-read-bg-rgb) / 0.92)", display: "flex", alignItems: "center", gap: 10 } : { marginTop: 8, padding: 8, display: "flex", alignItems: "center", gap: 10 }, children: [
      /* @__PURE__ */ jsx3("span", { style: { fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--tj-read-taupe)" }, children: "Zoom" }),
      /* @__PURE__ */ jsx3(
        "input",
        {
          "aria-label": "Photograph zoom",
          type: "range",
          min: 1,
          max: 3,
          step: 0.02,
          value: photo.crop.scale,
          onChange: (e) => setScale(parseFloat(e.target.value)),
          style: { flex: 1, accentColor: "var(--tj-gold, var(--tj-read-gold-default))" }
        }
      ),
      /* @__PURE__ */ jsx3(
        "button",
        {
          type: "button",
          onClick: () => setPhoto(slot, null),
          style: { fontFamily: "var(--font-sans)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tj-read-dim)", background: "transparent", border: "none", cursor: "pointer" },
          children: "remove"
        }
      )
    ] }),
    captionText && !liveEdit && /* @__PURE__ */ jsx3("figcaption", { style: { fontFamily: "'Lora',Georgia,serif", fontStyle: "italic", fontSize: 13, lineHeight: 1.5, color: "var(--tj-read-dim)", marginTop: 12 }, children: captionText }),
    liveEdit && captionField && /* @__PURE__ */ jsx3("figcaption", { style: { marginTop: 10 }, children: /* @__PURE__ */ jsx3(
      "input",
      {
        value: text(captionField, caption || ""),
        onChange: (e) => setText(captionField, e.target.value),
        placeholder: "caption\u2026",
        style: { width: "100%", fontFamily: "'Lora',Georgia,serif", fontStyle: "italic", fontSize: 13, color: "var(--tj-read-taupe)", background: "transparent", border: "none", borderBottom: "1px dashed rgb(var(--tj-read-gold-rgb) / 0.4)", outline: "none", padding: "4px 0" }
      }
    ) })
  ] });
};
var EditablePhoto_default = EditablePhoto;

// src/donors/teajia/conversation/RichText.tsx
import { jsx as jsx4 } from "react/jsx-runtime";
var HAN = /([㐀-鿿豈-﫿]+)/;
function withChinese(text, key) {
  return text.split(HAN).map(
    (part, i) => HAN.test(part) ? /* @__PURE__ */ jsx4("span", { lang: "zh-Hans", className: "tj-conv-cn", children: part }, `${key}-${i}`) : part
  );
}
function renderMarkup(text) {
  if (text.startsWith("\u201C")) return [/* @__PURE__ */ jsx4("span", { className: "tj-conv-hang", children: "\u201C" }, "hang"), ...renderMarkup(text.slice(1))];
  return text.split(/(==[^=]+==|_[^_]+_)/).flatMap((seg, i) => {
    if (seg.startsWith("==") && seg.endsWith("==") && seg.length > 4) {
      return [/* @__PURE__ */ jsx4("span", { className: "tj-conv-gold", children: withChinese(seg.slice(2, -2), `g${i}`) }, i)];
    }
    if (seg.startsWith("_") && seg.endsWith("_") && seg.length > 2) {
      return [/* @__PURE__ */ jsx4("em", { className: "tj-conv-em", children: withChinese(seg.slice(1, -1), `e${i}`) }, i)];
    }
    return withChinese(seg, `t${i}`);
  });
}
var Rich = ({ field, text, as = "p", className, style, multiline = true }) => {
  const { isOwner, editing, previewVisitor, text: stored } = useStoryEdit();
  if (isOwner && editing && !previewVisitor) {
    return /* @__PURE__ */ jsx4(EditableText, { field, as, className, style, multiline, children: text });
  }
  const Tag = as;
  return /* @__PURE__ */ jsx4(Tag, { className, style, children: renderMarkup(stored(field, text)) });
};

// src/donors/teajia/conversation/spec.ts
function turnStarts(spec) {
  const starts = /* @__PURE__ */ new Set();
  const walk = (blocks, last) => blocks.forEach((b) => {
    if (b.kind === "q" || b.kind === "n") last.v = "q";
    else if (b.kind === "a" || b.kind === "line") {
      if (last.v !== "a") starts.add(b.id);
      last.v = "a";
    } else if (b.kind === "side" || b.kind === "glyph") walk(b.blocks, last);
  });
  walk(spec.opening, { v: null });
  spec.parts.forEach((p) => walk(p.blocks, { v: null }));
  walk(spec.ending.blocks, { v: null });
  return starts;
}

// src/donors/teajia/conversation/ConversationCanvas.tsx
import { Fragment, jsx as jsx5, jsxs as jsxs3 } from "react/jsx-runtime";
var RecordedPassages = createContext2(/* @__PURE__ */ new Map());
var partWord = (n) => String(n);
var grainCss = (_a, _b) => ({});
var ChapterHead = ({ id, title, titleId }) => /* @__PURE__ */ jsx5("header", { id, className: "tj-conv-col", children: /* @__PURE__ */ jsx5(Passage, { id: titleId, text: title, className: "tj-conv-spread-title", as: "h2" }) });
var Passage = ({ id, text, className, as = "p", style }) => {
  const recorded = useContext2(RecordedPassages), document2 = id ? recorded.get(id) : void 0;
  return document2 ? /* @__PURE__ */ jsx5("div", { className, "data-recorded-passage": id, style, children: /* @__PURE__ */ jsx5(AcceptedProse, { paragraphId: id, document: document2 }) }) : /* @__PURE__ */ jsx5(Rich, { field: id || "unrecorded", text, className, as, style });
};
var recordedStyle = `.ar-donor-workspace .tj-conv [data-recorded-passage]::before,.ar-donor-workspace .tj-conv [data-recorded-passage]::after{content:none!important}
.ar-output-reader .tj-conv [data-recorded-passage]>.ar-recorded-prose{font:inherit;line-height:inherit;color:inherit;margin:0}
.ar-output-reader .tj-conv [data-recorded-passage]>.ar-recorded-prose>blockquote{border:0;padding:0;margin:0;color:inherit;font:inherit}
.ar-output-reader .tj-conv [data-recorded-passage]>.ar-recorded-prose>blockquote[data-source-ref]{border-left:2px solid var(--tj-gold);padding-left:1em}
.ar-output-reader .tj-conv .tj-conv-spread-title .ar-recorded-prose :is(h1,h2,h3){font:inherit;color:inherit;line-height:inherit;margin:0}
.ar-output-reader .tj-conv :is(.tj-conv-cover-hook,.tj-conv-line,.tj-conv-onphoto-words) .ar-recorded-prose strong{font-weight:400;color:var(--tj-gold-lt,var(--tj-read-gold-lt-default))}
.ar-output-reader .tj-conv [data-recorded-passage] .ar-recorded-prose p{font:inherit;line-height:inherit}`;
var Photo = ({ spec, shot, aspect = "4/5", fill }) => /* @__PURE__ */ jsx5(
  EditablePhoto_default,
  {
    slot: shot.slot,
    alt: shot.alt,
    aspect,
    fill,
    bare: true,
    defaultPhoto: { url: spec.images + shot.file, x: shot.x, y: shot.y }
  }
);
var SpeakerCtx = createContext2({ author: "", subject: "", starts: /* @__PURE__ */ new Set(), named: true });
var Who = ({ name }) => /* @__PURE__ */ jsxs3("span", { className: "tj-conv-who", children: [
  name,
  /* @__PURE__ */ jsx5("span", { className: "tj-sr-only", children: ": " })
] });
function groupRuns(blocks) {
  const out = [];
  blocks.forEach((b) => {
    const last = out[out.length - 1];
    if (b.kind === "q" || b.kind === "a" || b.kind === "n") {
      if (Array.isArray(last)) last.push(b);
      else out.push([b]);
    } else out.push(b);
  });
  return out;
}
var Line = ({ id, text, size, follow }) => {
  const { subject, starts } = useContext2(SpeakerCtx);
  const line = /* @__PURE__ */ jsxs3("div", { "data-size": size, children: [
    /* @__PURE__ */ jsx5(Passage, { id, text, className: "tj-conv-line" }),
    follow && /* @__PURE__ */ jsx5(Passage, { id: follow.id, text: follow.text, className: "tj-conv-a tj-conv-follow" })
  ] });
  return starts.has(id) ? /* @__PURE__ */ jsxs3("div", { className: "tj-conv-turn", children: [
    /* @__PURE__ */ jsx5(Who, { name: subject }),
    line
  ] }) : line;
};
var Words = ({ blocks }) => {
  const { author, subject, starts, named } = useContext2(SpeakerCtx);
  return /* @__PURE__ */ jsx5(Fragment, { children: blocks.map((b, i) => {
    if (b.kind === "q") {
      return /* @__PURE__ */ jsxs3("div", { className: "tj-conv-turn tj-conv-q", children: [
        named && /* @__PURE__ */ jsx5(Who, { name: author }),
        /* @__PURE__ */ jsx5(Passage, { id: b.id, text: b.text, className: "tj-conv-q-text" })
      ] }, b.id);
    }
    if (b.kind === "a") {
      return starts.has(b.id) ? /* @__PURE__ */ jsxs3("div", { className: "tj-conv-turn", children: [
        /* @__PURE__ */ jsx5(Who, { name: subject }),
        /* @__PURE__ */ jsx5(Passage, { id: b.id, text: b.text, className: "tj-conv-a" })
      ] }, b.id) : /* @__PURE__ */ jsx5(Passage, { id: b.id, text: b.text, className: "tj-conv-a" }, b.id);
    }
    if (b.kind === "n") return /* @__PURE__ */ jsx5(Passage, { id: b.id, text: b.text, className: "tj-conv-told" }, b.id);
    if (b.kind === "line") return /* @__PURE__ */ jsx5(Line, { id: b.id, text: b.text, size: b.size }, b.id);
    return /* @__PURE__ */ jsx5(React4.Fragment, {}, i);
  }) });
};
var BlockView = ({ spec, block }) => {
  if (Array.isArray(block)) {
    return /* @__PURE__ */ jsx5("section", { "data-reveal": "text", className: "tj-conv-col", children: /* @__PURE__ */ jsx5(Words, { blocks: block }) });
  }
  const b = block;
  switch (b.kind) {
    case "line":
      return /* @__PURE__ */ jsx5("div", { "data-reveal": "text", className: "tj-conv-spine", children: /* @__PURE__ */ jsx5(Line, { id: b.id, text: b.text, size: b.size, follow: b.follow }) });
    case "side":
      return /* @__PURE__ */ jsxs3("section", { className: "tj-conv-side", "data-flip": b.flip ? "" : void 0, "data-bleed": b.bleed ? "" : void 0, children: [
        /* @__PURE__ */ jsx5("div", { "data-reveal": "text", className: "tj-conv-side-words", children: /* @__PURE__ */ jsx5(Words, { blocks: b.blocks }) }),
        /* @__PURE__ */ jsx5("div", { "data-reveal": "photo", className: "tj-conv-side-photo", children: /* @__PURE__ */ jsx5(Photo, { spec, shot: b.shot }) })
      ] });
    case "photos":
      return /* @__PURE__ */ jsxs3("figure", { "data-reveal": "photo", className: "tj-conv-figure", "data-narrow": b.narrow ? "" : void 0, children: [
        /* @__PURE__ */ jsx5("div", { className: "tj-conv-photos", "data-stagger": b.stagger ? "" : void 0, children: b.shots.map((s) => /* @__PURE__ */ jsx5("div", { children: /* @__PURE__ */ jsx5(Photo, { spec, shot: s, aspect: b.aspect }) }, s.slot)) }),
        b.caption && /* @__PURE__ */ jsx5(Rich, { field: b.caption.id, text: b.caption.text, as: "figcaption", className: "tj-conv-caption" })
      ] });
    case "wide":
      return /* @__PURE__ */ jsx5("figure", { "data-reveal": "photo", className: "tj-conv-figure", "data-narrow": b.narrow ? "" : void 0, "data-offset": b.offset, children: /* @__PURE__ */ jsx5(Photo, { spec, shot: b.shot, aspect: b.aspect ?? "3/2" }) });
    case "bleed":
      return /* @__PURE__ */ jsx5("figure", { "data-reveal": "photo", className: "tj-conv-bleed", children: /* @__PURE__ */ jsx5(Photo, { spec, shot: b.shot, fill: true }) });
    case "on-photo":
      return /* @__PURE__ */ jsx5("figure", { "data-reveal": "photo", className: "tj-conv-onphoto", children: /* @__PURE__ */ jsxs3("div", { className: "tj-conv-onphoto-frame", style: { aspectRatio: b.aspect }, children: [
        /* @__PURE__ */ jsx5(Photo, { spec, shot: b.shot, fill: true }),
        /* @__PURE__ */ jsx5(Passage, { id: b.id, text: b.text, className: "tj-conv-onphoto-words", style: { color: b.ink, ["--tj-gold-lt"]: b.accent } })
      ] }) });
    case "glyph":
      return /* @__PURE__ */ jsx5("section", { "data-reveal": "text", className: "tj-conv-col", children: /* @__PURE__ */ jsxs3("div", { className: "tj-conv-glyph", children: [
        /* @__PURE__ */ jsx5("div", { "aria-hidden": "true", className: "tj-conv-glyph-mark", children: b.glyph }),
        /* @__PURE__ */ jsx5("div", { children: /* @__PURE__ */ jsx5(Words, { blocks: b.blocks }) })
      ] }) });
    default:
      return null;
  }
};
var PartOpening = ({ spec, part, n, titleId }) => {
  if (!part.opener) return /* @__PURE__ */ jsx5(ChapterHead, { part: n, id: `part-${n}`, title: part.title, titleId });
  return /* @__PURE__ */ jsxs3("section", { id: `part-${n}`, className: "tj-conv-spread", "data-flip": n % 2 === 0 ? "" : void 0, "aria-labelledby": `part-${n}-title`, children: [
    /* @__PURE__ */ jsx5("div", { "data-reveal": "photo", className: "tj-conv-spread-photo", children: /* @__PURE__ */ jsx5(Photo, { spec, shot: part.opener, fill: true }) }),
    /* @__PURE__ */ jsxs3("header", { "data-reveal": "text", className: "tj-conv-spread-head", children: [
      spec.form !== "story" && /* @__PURE__ */ jsxs3("span", { className: "tj-conv-spread-part", children: [
        "Part ",
        partWord(n)
      ] }),
      /* @__PURE__ */ jsx5("div", { id: `part-${n}-title`, children: /* @__PURE__ */ jsx5(Passage, { id: titleId, text: part.title, as: "h2", className: "tj-conv-spread-title" }) }),
      /* @__PURE__ */ jsx5("span", { "aria-hidden": "true", className: "tj-conv-spread-rule" })
    ] })
  ] });
};
var CoverWords = ({ spec }) => spec.form === "story" && (spec.hook || spec.recordedFields?.hookId) ? /* @__PURE__ */ jsx5(Passage, { id: spec.recordedFields?.hookId, text: spec.hook || "", className: "tj-conv-cover-hook" }) : /* @__PURE__ */ jsx5("p", { className: "tj-conv-dek", children: /* @__PURE__ */ jsx5(EditableText, { field: "dek-2", as: "span", multiline: true, children: spec.dek }) });
var TypesetCover = ({ spec }) => /* @__PURE__ */ jsxs3("header", { className: "tj-conv-cover-typeset", "data-testid": "conv-cover-typeset", children: [
  /* @__PURE__ */ jsxs3("h1", { className: "tj-conv-title", children: [
    /* @__PURE__ */ jsx5(EditableText, { field: "title-1", as: "span", children: spec.title[0] }),
    spec.title[1] && /* @__PURE__ */ jsxs3(Fragment, { children: [
      /* @__PURE__ */ jsx5("br", {}),
      /* @__PURE__ */ jsx5("span", { className: "tj-conv-title-2", children: /* @__PURE__ */ jsx5(EditableText, { field: "title-2", as: "span", children: spec.title[1] }) })
    ] })
  ] }),
  /* @__PURE__ */ jsx5("span", { "aria-hidden": "true", className: "tj-conv-cover-rule" }),
  /* @__PURE__ */ jsx5(CoverWords, { spec })
] });
var Cover = ({ spec }) => !spec.portrait ? /* @__PURE__ */ jsx5(TypesetCover, { spec }) : /* @__PURE__ */ jsxs3("header", { className: "tj-cover-dissolve tj-conv-cover", children: [
  /* @__PURE__ */ jsx5("div", { className: "tj-cover-photo tj-conv-cover-photo", style: { background: "linear-gradient(155deg,var(--tj-read-empty-from) 0%,var(--tj-read-bg) 80%)" }, children: /* @__PURE__ */ jsx5(
    EditablePhoto_default,
    {
      slot: spec.portrait.slot,
      alt: spec.portrait.alt,
      fill: true,
      defaultPhoto: { url: spec.images + spec.portrait.file, x: spec.portrait.x, y: spec.portrait.y },
      placeholder: /* @__PURE__ */ jsx5("div", { "aria-hidden": "true", style: { ...grainCss("0.8", 150), opacity: 0.08 } })
    }
  ) }),
  /* @__PURE__ */ jsxs3("div", { className: "tj-cover-text tj-conv-cover-text", children: [
    /* @__PURE__ */ jsxs3("h1", { className: "tj-conv-title", children: [
      /* @__PURE__ */ jsx5(EditableText, { field: "title-1", as: "span", children: spec.title[0] }),
      spec.title[1] && /* @__PURE__ */ jsxs3(Fragment, { children: [
        /* @__PURE__ */ jsx5("br", {}),
        /* @__PURE__ */ jsx5("span", { className: "tj-conv-title-2", children: /* @__PURE__ */ jsx5(EditableText, { field: "title-2", as: "span", children: spec.title[1] }) })
      ] })
    ] }),
    spec.form === "story" && (spec.hook || spec.recordedFields?.hookId) ? /* @__PURE__ */ jsx5(Passage, { id: spec.recordedFields?.hookId, text: spec.hook || "", className: "tj-conv-cover-hook" }) : /* @__PURE__ */ jsx5("p", { className: "tj-conv-dek", children: /* @__PURE__ */ jsx5(EditableText, { field: "dek-2", as: "span", multiline: true, children: spec.dek }) })
  ] })
] });
function ConversationCanvas({ spec, paragraphs }) {
  const recorded = spec, fields = recorded.recordedFields;
  const recordedRows = paragraphs || recorded.recordedParagraphs || [];
  const hasSaying = Boolean(spec.ending.saying.text || recordedRows.some((p) => p.id === spec.ending.saying.id));
  const hasClosing = Boolean(spec.closing || fields?.closingId);
  const speakers = { ...spec.speakers, starts: spec.form === "story" ? /* @__PURE__ */ new Set() : turnStarts(spec), named: spec.form !== "story" };
  return /* @__PURE__ */ jsx5(RecordedPassages.Provider, { value: new Map(recordedRows.map((p) => [p.id, p.doc])), children: /* @__PURE__ */ jsx5(SpeakerCtx.Provider, { value: speakers, children: /* @__PURE__ */ jsxs3("article", { className: "tj-conv", "data-form": spec.form || "story", children: [
    /* @__PURE__ */ jsx5("style", { children: recordedStyle }),
    /* @__PURE__ */ jsx5(Cover, { spec }),
    (spec.intro || fields?.introId) && /* @__PURE__ */ jsx5("section", { className: "tj-conv-col tj-conv-intro", children: /* @__PURE__ */ jsx5(Passage, { id: fields?.introId, text: spec.intro, className: "tj-conv-intro-text" }) }),
    groupRuns(spec.opening).map((block, i) => /* @__PURE__ */ jsx5(BlockView, { spec, block }, i)),
    spec.parts.map((part, i) => /* @__PURE__ */ jsxs3(React4.Fragment, { children: [
      /* @__PURE__ */ jsx5(PartOpening, { spec, part, n: i + 1, titleId: fields?.partTitleIds[i] }),
      groupRuns(part.blocks).map((block, j) => /* @__PURE__ */ jsx5(BlockView, { spec, block }, j))
    ] }, i)),
    groupRuns(spec.ending.blocks).map((block, i) => /* @__PURE__ */ jsx5(BlockView, { spec, block }, "e" + i)),
    hasSaying && /* @__PURE__ */ jsxs3("section", { className: "tj-conv-saying", children: [
      /* @__PURE__ */ jsx5(Line, { id: spec.ending.saying.id, text: spec.ending.saying.text, size: "l" }),
      !hasClosing && /* @__PURE__ */ jsx5("span", { "aria-hidden": "true", lang: "zh-Hans", className: "tj-conv-endmark", children: "\u5BB6" })
    ] }),
    spec.ending.shot && /* @__PURE__ */ jsx5("figure", { className: "tj-conv-close", children: /* @__PURE__ */ jsx5(Photo, { spec, shot: spec.ending.shot, aspect: spec.ending.aspect }) }),
    hasClosing && /* @__PURE__ */ jsxs3("section", { className: "tj-conv-col tj-conv-closing", children: [
      /* @__PURE__ */ jsx5(Passage, { id: fields?.closingId, text: spec.closing || "", className: "tj-conv-intro-text" }),
      /* @__PURE__ */ jsx5("span", { "aria-hidden": "true", lang: "zh-Hans", className: "tj-conv-endmark", children: "\u5BB6" })
    ] }),
    /* @__PURE__ */ jsx5("footer", { className: "tj-conv-credit", children: spec.credit.map((line, i) => /* @__PURE__ */ jsx5("p", { children: line }, i)) })
  ] }) }) });
}

// src/donors/wordforge/wf-block-markdown.ts
import { fromMarkdown as fromMarkdown2 } from "mdast-util-from-markdown";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

// src/donors/wordforge/wf-markdown-options.mjs
var PARSE_OPTIONS = {
  extensions: [{
    disable: {
      null: [
        "autolink",
        "labelStartLink",
        "labelStartImage",
        "labelEnd",
        "definition",
        "codeIndented",
        "codeFenced",
        "htmlFlow",
        "htmlText",
        "thematicBreak",
        "setextUnderline",
        "characterReference"
      ]
    }
  }]
};
var LINK_PARSE_OPTIONS = { extensions: [{ disable: { null: PARSE_OPTIONS.extensions[0].disable.null.filter((name) => !["labelStartLink", "labelEnd"].includes(name)) } }] };

// src/donors/wordforge/wf-block-serialize.mjs
import { fromMarkdown } from "mdast-util-from-markdown";
function escapeInline(text) {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const prev = text[i - 1] ?? " ";
    const next = text[i + 1] ?? " ";
    const floating = /\s/.test(prev) && /\s/.test(next);
    if (ch === "\\" && /[!-/:-@[-`{-~]/.test(next)) out += "\\\\";
    else if (ch === "`") out += "\\`";
    else if (ch === "*" && !floating) out += "\\*";
    else if (ch === "_" && !floating && !(/\w/.test(prev) && /\w/.test(next))) out += "\\_";
    else out += ch;
  }
  return out;
}
function escapeLineStart(line) {
  return line.replace(/^(\s*)(#{1,6}(?=\s|$)|[-+*](?=\s)|\d{1,9}[.)](?=\s)|>)/, "$1\\$2");
}
var MARK_ORDER = ["link", "bold", "italic", "code"];
function linkDestination(mark) {
  const href = String(mark.attrs?.href || ""), title = mark.attrs?.title ?? null, original = mark.attrs?.markdownDestination;
  if (typeof original === "string") {
    const parsed = fromMarkdown("[x" + original, LINK_PARSE_OPTIONS).children[0], link = parsed?.children?.[0];
    if (parsed?.children?.length === 1 && link?.type === "link" && link.position?.end.offset === original.length + 2 && link.url === href && (link.title ?? null) === title) return original;
  }
  const url = /[()]/.test(href) ? "<" + href + ">" : href;
  return "](" + url + (typeof title === "string" ? ' "' + title.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"' : "") + ")";
}
function closingFor(mark) {
  return mark.type === "link" ? linkDestination(mark) : delimiterFor(mark);
}
function delimiterFor(mark) {
  if (mark.type === "link") return "[";
  if (mark.type === "bold") return mark.attrs?.markup === "__" ? "__" : "**";
  if (mark.type === "italic") return mark.attrs?.markup === "*" ? "*" : "_";
  if (mark.type === "code") return "`";
  return "";
}
function sameMark(a, b) {
  return a.type === b.type && (a.type === "link" ? a.attrs?.href === b.attrs?.href && (a.attrs?.title ?? null) === (b.attrs?.title ?? null) && a.attrs?.markdownDestination === b.attrs?.markdownDestination : delimiterFor(a) === delimiterFor(b));
}
function sharedPrefix(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && sameMark(a[n], b[n])) n += 1;
  return n;
}
function runsOf(nodes) {
  const runs = [];
  for (const node of nodes) {
    if (node.type === "hardBreak") {
      runs.push({ brk: true });
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const marks = node.text.trim() === "" ? [] : [...node.marks ?? []].filter((mark) => MARK_ORDER.includes(mark.type) && (mark.type !== "link" || safePassageHref(mark.attrs?.href))).sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
    const last = runs[runs.length - 1];
    if (last && "text" in last && last.marks.length === marks.length && sharedPrefix(last.marks, marks) === marks.length) {
      last.text += node.text;
    } else {
      runs.push({ text: node.text, marks });
    }
  }
  return runs;
}
function serializeInline(nodes) {
  const runs = runsOf(nodes);
  let out = "";
  const active = [];
  const closeTo = (depth) => {
    while (active.length > depth) out += closingFor(active.pop());
  };
  runs.forEach((run, index) => {
    if ("brk" in run) {
      closeTo(0);
      out += "\n";
      return;
    }
    let text = run.text;
    closeTo(sharedPrefix(active, run.marks));
    const opening = run.marks.slice(active.length);
    if (opening.length) {
      const leading = text.match(/^\s+/)?.[0] ?? "";
      out += leading;
      text = text.slice(leading.length);
    }
    for (const mark of opening) {
      out += delimiterFor(mark);
      active.push(mark);
    }
    const next = runs[index + 1];
    const keepAfter = next && "text" in next ? sharedPrefix(active, next.marks) : 0;
    const trailing = active.length > keepAfter ? text.match(/\s+$/)?.[0] ?? "" : "";
    const body = trailing ? text.slice(0, -trailing.length) : text;
    const escaped = escapeInline(body);
    out += active.some((mark) => mark.type === "code") ? body : active.some((mark) => mark.type === "link") ? escaped.replace(/[\[\]]/g, "\\$&") : escaped;
    closeTo(keepAfter);
    out += trailing;
  });
  closeTo(0);
  return out;
}
function inlineOf(node) {
  return serializeInline(node.content ?? []).split("\n").map(escapeLineStart).join("\n");
}
function indentContinuation(text, indent) {
  return text.split("\n").map((line, i) => i === 0 || line === "" ? line : indent + line).join("\n");
}
function serializeBlock(node) {
  switch (node.type) {
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `${"#".repeat(level)} ${inlineOf(node)}`;
    }
    case "bulletList":
    case "orderedList": {
      const tight = node.attrs?.tight !== false;
      const start = Number(node.attrs?.start ?? 1);
      const items = (node.content ?? []).map((item, i) => {
        const marker = node.type === "bulletList" ? "- " : `${start + i}. `;
        return marker + indentContinuation(serializeBlocks(item.content ?? []), " ".repeat(marker.length));
      });
      return items.join(tight ? "\n" : "\n\n");
    }
    case "blockquote":
      return serializeBlocks(node.content ?? []).split("\n").map((line) => line ? `> ${line}` : ">").join("\n");
    case "paragraph":
    default:
      return inlineOf(node);
  }
}
function separatorFor(node, previous) {
  if (!previous) return "";
  const sep = node.attrs?.sep ?? null;
  if (sep === "line") return "\n";
  if (sep === "blank") return "\n\n";
  return previous.type === "heading" && node.type === "paragraph" ? "\n" : "\n\n";
}
function serializeBlocks(nodes) {
  let out = "";
  let previous = null;
  for (const node of nodes) {
    out += separatorFor(node, previous) + serializeBlock(node);
    previous = node;
  }
  return out;
}
function docToMarkdown(doc) {
  return serializeBlocks(doc.content ?? []);
}

// src/donors/wordforge/wf-block-markdown.ts
var PassageMarkdownAttributes = Extension.create({
  name: "passageMarkdownAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "bulletList", "orderedList", "blockquote"],
        attributes: { sep: { default: null, rendered: false } }
      },
      {
        types: ["bulletList", "orderedList"],
        attributes: { tight: { default: true, rendered: false } }
      },
      { types: ["link"], attributes: { markdownDestination: { default: null, rendered: false } } },
      {
        types: ["bold", "italic"],
        attributes: { markup: { default: null, rendered: false } }
      }
    ];
  }
});

// src/workspaces/article-composition.mjs
var ARTICLE_COMPOSITION_SCHEMA = "ar-create.article-composition.v1";
function articleCompositionIssue(value, paragraphs, placements = []) {
  const fail = (message) => {
    throw new Error(message);
  };
  const object = (v, keys) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some((k) => !keys.includes(k))) fail("Invalid article layout fields.");
  };
  const text = (v, max = 256) => typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
  const list = (v) => {
    if (!Array.isArray(v) || v.length > 5e3) fail("Invalid article layout list.");
  };
  const optionalBool = (v, key) => {
    if (v[key] !== void 0 && typeof v[key] !== "boolean") fail("Invalid article layout option.");
  };
  const aspect = (v) => {
    if (v !== void 0 && (!text(v, 32) || !/^[1-9]\d*(?:\.\d+)?\/[1-9]\d*(?:\.\d+)?$/.test(v))) fail("Invalid article photo aspect.");
  };
  try {
    object(value, ["schema", "form", "hookId", "introId", "closingId", "portraitSlot", "opening", "parts", "ending"]);
    if (value.schema !== ARTICLE_COMPOSITION_SCHEMA || value.form !== void 0 && !["story", "conversation"].includes(value.form)) fail("Unknown article layout format.");
    const ids = new Set(paragraphs.map((p) => p.id)), slots = new Set(placements.map((p) => p.slot));
    if (ids.size !== paragraphs.length || slots.size !== placements.length) fail("Article identities must be unique.");
    const usedIds = /* @__PURE__ */ new Set(), usedSlots = /* @__PURE__ */ new Set();
    const passage = (id) => {
      if (!text(id) || !ids.has(id)) fail("Article layout references a missing accepted passage.");
      if (usedIds.has(id)) fail("Article layout repeats an accepted passage.");
      usedIds.add(id);
    };
    const photo = (slot) => {
      if (!text(slot) || !slots.has(slot)) fail("Article layout references a photo slot it does not own.");
      if (usedSlots.has(slot)) fail("Article layout repeats a photo slot.");
      usedSlots.add(slot);
    };
    const walk = (blocks, depth = 0, wordsOnly = false) => {
      list(blocks);
      if (depth > 8) fail("Article layout is nested too deeply.");
      for (const b of blocks) {
        if (!b || typeof b !== "object") fail("Invalid article block.");
        if (wordsOnly && !["q", "a", "n", "line"].includes(b.kind)) fail("Side and glyph frames contain words only.");
        switch (b.kind) {
          case "q":
          case "a":
          case "n":
            object(b, ["kind", "paragraphId"]);
            passage(b.paragraphId);
            break;
          case "line":
            object(b, ["kind", "paragraphId", "size", "followId"]);
            passage(b.paragraphId);
            if (!["xl", "l", "m"].includes(b.size)) fail("Invalid article line size.");
            if (b.followId !== void 0) passage(b.followId);
            break;
          case "side":
            object(b, ["kind", "slot", "flip", "bleed", "blocks"]);
            photo(b.slot);
            optionalBool(b, "flip");
            optionalBool(b, "bleed");
            walk(b.blocks, depth + 1, true);
            break;
          case "glyph":
            object(b, ["kind", "glyph", "blocks"]);
            if (!text(b.glyph, 32)) fail("Invalid article glyph.");
            walk(b.blocks, depth + 1, true);
            break;
          case "photos":
            object(b, ["kind", "slots", "aspect", "stagger", "narrow"]);
            list(b.slots);
            if (b.slots.length < 1 || b.slots.length > 2) fail("An article photo pair has one or two photos.");
            b.slots.forEach(photo);
            aspect(b.aspect);
            optionalBool(b, "stagger");
            optionalBool(b, "narrow");
            break;
          case "wide":
            object(b, ["kind", "slot", "aspect", "narrow", "offset"]);
            photo(b.slot);
            aspect(b.aspect);
            optionalBool(b, "narrow");
            if (b.offset !== void 0 && !["left", "right"].includes(b.offset)) fail("Invalid article photo offset.");
            break;
          case "bleed":
            object(b, ["kind", "slot"]);
            photo(b.slot);
            break;
          case "on-photo":
            object(b, ["kind", "paragraphId", "slot", "aspect", "ink", "accent"]);
            passage(b.paragraphId);
            photo(b.slot);
            aspect(b.aspect);
            if (!b.aspect || !/^#[a-f\d]{6}$/i.test(b.ink || "") || !/^#[a-f\d]{6}$/i.test(b.accent || "")) fail("An on-photo passage needs its measured colors and aspect.");
            break;
          default:
            fail("Unknown article block.");
        }
      }
    };
    for (const key of ["hookId", "introId", "closingId"]) if (value[key] !== void 0) passage(value[key]);
    if (value.portraitSlot !== void 0) photo(value.portraitSlot);
    walk(value.opening);
    list(value.parts);
    for (const part of value.parts) {
      object(part, ["titleId", "openerSlot", "blocks"]);
      passage(part.titleId);
      const title = paragraphs.find((p) => p.id === part.titleId);
      if (title.doc?.content?.length !== 1 || title.doc.content[0].type !== "heading") fail("An article chapter title must reference an accepted heading.");
      if (part.openerSlot !== void 0) photo(part.openerSlot);
      walk(part.blocks);
    }
    object(value.ending, ["blocks", "sayingId", "photoSlot", "aspect"]);
    walk(value.ending.blocks);
    if (value.ending.sayingId !== void 0) passage(value.ending.sayingId);
    if (value.ending.photoSlot !== void 0) photo(value.ending.photoSlot);
    aspect(value.ending.aspect);
    if (usedIds.size !== ids.size) fail("Article layout omits an accepted passage.");
    return void 0;
  } catch (error) {
    return error.message;
  }
}
function validateArticleComposition(value, paragraphs, placements = []) {
  const issue = articleCompositionIssue(value, paragraphs, placements);
  if (issue) throw new Error(issue);
  return value;
}

// src/workspaces/articleComposition.ts
var empty = () => ({ schema: ARTICLE_COMPOSITION_SCHEMA, form: "story", opening: [], parts: [], ending: { blocks: [] } });
var textOf = (node) => node.type === "text" ? node.text || "" : node.type === "hardBreak" ? "\n" : node.type === "referenceCard" ? `Reference \xB7 ${node.attrs?.sourceTitle || "Source"} ${node.attrs?.text || ""}` : (node.content || []).map(textOf).join(node.type === "doc" ? "\n" : "");
var acceptedText = (p) => textOf(p.doc);
var role = (p) => {
  const node = p.doc.content?.[0], text = acceptedText(p).trim();
  if (p.doc.content?.length === 1 && /^[“"][\s\S]*[”"]$/.test(text)) {
    const leaves = node?.content?.filter((n) => n.type === "text") || [];
    return node?.type === "paragraph" && leaves.length > 0 && leaves.every((n) => n.marks?.some((m) => m.type === "italic")) ? "q" : "a";
  }
  return "n";
};
function inferArticleComposition(paragraphs) {
  const layout = empty();
  let target = layout.opening;
  for (const p of paragraphs) {
    if (p.doc.content?.length === 1 && p.doc.content[0].type === "heading") {
      const part = { titleId: p.id, blocks: [] };
      layout.parts.push(part);
      target = part.blocks;
    } else target.push({ kind: role(p), paragraphId: p.id });
  }
  return layout;
}

// src/workspaces/structured-markdown.mjs
function structuredMarkdown(doc) {
  const copy = structuredClone(doc);
  const visit = (node) => {
    if (node.type === "referenceCard") {
      node.type = "paragraph";
      node.content = [{ type: "text", text: `[Reference: ${node.attrs?.sourceTitle || ""}] ${node.attrs?.text || ""}` }];
    }
    if (node.type === "blockquoteAttributed") {
      node.type = "blockquote";
      node.content = [{ type: "paragraph", content: node.content || [] }, { type: "paragraph", content: [{ type: "text", text: `\u2014 ${node.attrs?.author || node.attrs?.sourceTitle || "Source"}` }] }];
    }
    node.content?.forEach(visit);
  };
  visit(copy);
  return docToMarkdown(copy);
}

// src/workspaces/document.ts
function locatorLabel(locator) {
  if (typeof locator === "string") {
    try {
      if (locator.trim().startsWith("{")) return locatorLabel(JSON.parse(locator));
    } catch {
    }
    return locator.length > 120 ? "Passage in source" : locator || "Passage in source";
  }
  if (!locator) return "Passage in source";
  if (locator.page !== void 0) return `Page ${locator.page}`;
  if (locator.lineStart !== void 0) return `Line ${locator.lineStart}${locator.lineEnd !== void 0 && locator.lineEnd !== locator.lineStart ? "\u2013" + locator.lineEnd : ""}`;
  if (typeof locator.start === "number") return `Characters ${locator.start + 1}${typeof locator.end === "number" ? "\u2013" + locator.end : ""}`;
  const path = typeof locator.path === "string" ? locator.path : "";
  return path ? path.split(/[\\/]/).at(-1) || "Passage in source" : "Passage in source";
}
function deriveMarkdown(doc) {
  const prose = doc.paragraphs.map((p) => structuredMarkdown(p.doc)).join("\n\n");
  const refs = doc.paragraphs.flatMap((p) => p.attributions).filter((a, i, all) => all.findIndex((b) => b.id === a.id) === i);
  return prose + (refs.length ? "\n\n## Sources\n\n" + refs.map((a) => `- ${a.form === "paraphrase" ? "Paraphrase \xB7 review required" : a.form === "reference" ? "Reference" : "Quotation"}: ${a.sourceTitle}${a.author ? " \u2014 " + a.author : ""}. ${locatorLabel(a.locator)}
  Original excerpt: \u201C${a.excerpt}\u201D`).join("\n") : "");
}

// src/workspaces/compositionSpec.ts
function outputSpec(doc, output) {
  const paragraphs = output.manuscript || doc.paragraphs;
  const byId = new Map(paragraphs.map((p) => [p.id, p]));
  const layout = output.articleComposition || inferArticleComposition(paragraphs);
  validateArticleComposition(layout, paragraphs, output.placements);
  const text = (id) => id ? acceptedText(byId.get(id)) : "";
  const owned = new Map(output.placements.map((p) => [p.slot, p]));
  const used = /* @__PURE__ */ new Set();
  const shot = (slot) => {
    const p = owned.get(slot);
    used.add(slot);
    return { slot, file: p.url, alt: p.alt, x: p.x, y: p.y };
  };
  const photoBlock = (p) => p.caption ? { kind: "photos", shots: [shot(p.slot)], aspect: "3/2", caption: { id: "photo-caption:" + p.slot, text: p.caption } } : { kind: "wide", shot: shot(p.slot), aspect: "3/2" };
  const block = (b) => {
    switch (b.kind) {
      case "q":
      case "a":
      case "n":
        return { kind: b.kind, id: b.paragraphId, text: text(b.paragraphId) };
      case "line":
        return { kind: "line", id: b.paragraphId, text: text(b.paragraphId), size: b.size, ...b.followId ? { follow: { id: b.followId, text: text(b.followId) } } : {} };
      case "side":
        return { kind: "side", shot: shot(b.slot), blocks: b.blocks.map(block), flip: b.flip, bleed: b.bleed };
      case "glyph":
        return { kind: "glyph", glyph: b.glyph, blocks: b.blocks.map(block) };
      case "photos": {
        const captions = b.slots.map((slot) => owned.get(slot).caption).filter(Boolean);
        return { kind: "photos", shots: b.slots.map(shot), aspect: b.aspect, stagger: b.stagger, narrow: b.narrow, ...captions.length ? { caption: { id: "photo-caption:" + b.slots.join(":"), text: captions.join(" \xB7 ") } } : {} };
      }
      case "wide": {
        const p = owned.get(b.slot);
        if (p.caption) return { kind: "photos", shots: [shot(b.slot)], aspect: b.aspect || "3/2", narrow: b.narrow, caption: { id: "photo-caption:" + b.slot, text: p.caption } };
        return { kind: "wide", shot: shot(b.slot), aspect: b.aspect, narrow: b.narrow, offset: b.offset };
      }
      case "bleed":
        return { kind: "bleed", shot: shot(b.slot) };
      case "on-photo":
        return { kind: "on-photo", id: b.paragraphId, text: text(b.paragraphId), shot: shot(b.slot), aspect: b.aspect, ink: b.ink, accent: b.accent };
    }
  };
  const coverSlot = layout.portraitSlot || (owned.has("cover") ? "cover" : void 0);
  const portrait = coverSlot ? shot(coverSlot) : void 0;
  const opening = layout.opening.map(block);
  const parts = layout.parts.map((p) => ({ title: text(p.titleId), opener: p.openerSlot ? shot(p.openerSlot) : void 0, blocks: p.blocks.map(block) }));
  const ending = { blocks: layout.ending.blocks.map(block), saying: { id: layout.ending.sayingId || "end", text: text(layout.ending.sayingId) }, shot: layout.ending.photoSlot ? shot(layout.ending.photoSlot) : void 0, aspect: layout.ending.aspect };
  const extra = output.placements.filter((p) => p.slot !== "cover" && !used.has(p.slot));
  const placed = /* @__PURE__ */ new Set();
  const append = (blocks) => blocks.flatMap((b) => {
    const nestedIds = (value) => "id" in value ? [value.id, ...value.kind === "line" && value.follow ? [value.follow.id] : []] : value.kind === "side" || value.kind === "glyph" ? value.blocks.flatMap(nestedIds) : [];
    const ids = nestedIds(b);
    const photos = extra.filter((p) => p.paragraphId && ids.includes(p.paragraphId) && !placed.has(p.slot));
    photos.forEach((p) => placed.add(p.slot));
    return [b, ...photos.map(photoBlock)];
  });
  const anchoredOpening = append(opening);
  parts.forEach((p) => {
    p.blocks = append(p.blocks);
  });
  ending.blocks = append(ending.blocks);
  if (!output.articleComposition && !parts.length) {
    for (const [i, p] of extra.entries()) if (!p.paragraphId && !placed.has(p.slot)) {
      const anchor = paragraphs[i]?.id, index = anchoredOpening.findIndex((b) => "id" in b && b.id === anchor);
      if (index >= 0) {
        anchoredOpening.splice(index + 1, 0, photoBlock(p));
        placed.add(p.slot);
      }
    }
  }
  extra.filter((p) => !placed.has(p.slot)).forEach((p) => ending.blocks.push(photoBlock(p)));
  const title = output.title || doc.title || "Untitled piece";
  const references = paragraphs.flatMap((p) => p.attributions).filter((a, i, all) => all.findIndex((b) => b.id === a.id) === i);
  return { slug: output.id, path: "", images: "", source: references.map((r) => r.sourceId).join(","), pageTitle: title, title: [title, ""], dek: "", subject: { name: "", role: "" }, speakers: { author: "", subject: "" }, form: layout.form || "story", author: { name: "", links: [] }, portrait, hook: text(layout.hookId) || void 0, intro: text(layout.introId), closing: text(layout.closingId) || void 0, opening: anchoredOpening, parts, ending, credit: [`Manuscript revision ${output.manuscriptRevision} \xB7 private composition`, ...references.map((r) => `${r.form === "paraphrase" ? "Paraphrase, review required" : r.form === "reference" ? "Reference" : "Quotation"}: ${r.sourceTitle}${r.author ? " \u2014 " + r.author : ""} \xB7 ${locatorLabel(r.locator)}`)], next: [], recordedParagraphs: paragraphs, recordedFields: { hookId: layout.hookId, introId: layout.introId, closingId: layout.closingId, partTitleIds: layout.parts.map((p) => p.titleId) } };
}

// src/workspaces/editorial-state.mjs
var protectedEditorial = /%%[\s\S]*?%%|<!--[\s\S]*?-->|`[^`\n]*`/g;
var personalNoteQuestions = (raw) => [...String(raw || "").matchAll(/%%\s*you\s*:\s*([\s\S]*?)%%/gi)].map((match) => match[1].trim().replace(/\s+/g, " ")).filter(Boolean);
function approvalMarks(raw) {
  const text = String(raw || "").replace(protectedEditorial, "");
  const pairs = [...text.matchAll(/==(?=\S)([\s\S]*?\S)==/g)].length, remaining = text.replace(/==(?=\S)([\s\S]*?\S)==/g, "");
  const incomplete = [...remaining.matchAll(/(?:^|\n|\s)==(?=\S)|(?<=\S)==(?=$|\n)/g)].length;
  return { pairs, tokens: pairs * 2 + incomplete };
}
function nodeText(node) {
  if (!node || node.type === "codeBlock") return "";
  if (node.type === "text") return node.marks?.some((mark) => mark.type === "code") ? "" : node.text || "";
  if (node.type === "referenceCard") return [node.attrs?.sourceTitle, node.attrs?.author, node.attrs?.text].filter(Boolean).join("\n");
  return [node.type === "blockquoteAttributed" ? node.attrs?.author || node.attrs?.sourceTitle : "", ...(node.content || []).map(nodeText)].join(node.type === "doc" ? "\n" : "");
}
function outputEditorialIssues(output, fallback = {}) {
  const words = output?.kind === "carousel" ? [output.title || fallback.title || "", output.caption || "", ...(output.slides || []).flatMap((slide) => [slide.text || "", slide.label ?? output.importedDraft?.label ?? output.title ?? fallback.title ?? "", slide.credit || ""])] : [output?.title || fallback.title || "", ...(output?.manuscript || fallback.paragraphs || []).flatMap((paragraph) => [nodeText(paragraph.doc), ...(paragraph.attributions || []).flatMap((source) => [source.sourceTitle || "", source.author || "", typeof source.locator === "string" ? source.locator : source.locator?.path || source.locator?.page || source.locator?.lineStart || ""])]), ...(output?.placements || []).flatMap((photo) => [photo.caption || "", photo.alt || ""])];
  return words.reduce((issues, word) => ({ approvalTokens: issues.approvalTokens + approvalMarks(word).tokens, personalNotes: issues.personalNotes + personalNoteQuestions(word).length }), { approvalTokens: 0, personalNotes: 0 });
}
function assertOutputEditorialReady(output, fallback) {
  const issues = outputEditorialIssues(output, fallback);
  if (issues.approvalTokens) throw Error("Approve or remove marked prose (==\u2026==) in Writing content before arranging visuals or exporting a public file.");
  if (issues.personalNotes) throw Error("Remove editorial %%you%% notes from the visible wording before arranging or exporting. Personal contribution is optional; you can skip it.");
  return true;
}

// src/workspaces/exportOutput.tsx
import { jsx as jsx6 } from "react/jsx-runtime";
function outputMarkdown(doc, output) {
  assertOutputEditorialReady(output, { paragraphs: doc.paragraphs, title: doc.title });
  return "# " + (output.title || doc.title) + "\n\n" + deriveMarkdown({ ...doc, paragraphs: output.manuscript || doc.paragraphs, title: output.title || doc.title }) + "\n\n---\nManuscript revision " + output.manuscriptRevision + "\n";
}
var blobDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error("An output asset could not be read."));
  reader.readAsDataURL(blob);
});
async function outputHtml(doc, output, { readAsset = fetch, stylesheetUrl = "/assets/app.css" } = {}) {
  assertOutputEditorialReady(output, { paragraphs: doc.paragraphs, title: doc.title });
  const cssResponse = await readAsset(stylesheetUrl);
  if (!cssResponse.ok) throw new Error("The article styles could not be included.");
  let css = await cssResponse.text();
  const workingFonts = await readAsset("/assets/fonts/wordforge.css");
  if (!workingFonts.ok) throw new Error("The article working fonts could not be included.");
  css += (await workingFonts.text()).replace(/url\(([a-z0-9]+\.woff2)\)/g, "url('/assets/fonts/$1')");
  const fontPaths = [...new Set([...css.matchAll(/url\(["']?(\/assets\/[^"')]+\.woff2)["']?\)/g)].map((m) => m[1]))];
  for (const fontPath of fontPaths) {
    const response = await readAsset(fontPath);
    if (!response.ok) throw new Error("An article font could not be included.");
    const embedded = await blobDataUrl(await response.blob());
    css = css.replaceAll(fontPath, embedded);
  }
  const placements = await Promise.all(output.placements.map(async (p) => {
    if (!p.url) return p;
    const url = new URL(p.url, location.origin);
    if (url.origin !== location.origin) throw new Error("Import external photographs into your own library before exporting the page.");
    const response = await readAsset(url);
    if (!response.ok) throw new Error("One photograph could not be included.");
    const blob = await response.blob();
    const embedded = await blobDataUrl(blob);
    return { ...p, url: embedded };
  }));
  const html = renderToStaticMarkup(/* @__PURE__ */ jsx6("div", { className: "ar-donor-workspace", children: /* @__PURE__ */ jsx6("main", { className: "ar-output-reader", children: /* @__PURE__ */ jsx6(LocalStoryProvider, { placements, editing: false, onPlacements: () => {
  }, children: /* @__PURE__ */ jsx6(ConversationCanvas, { spec: outputSpec(doc, { ...output, placements }), paragraphs: output.manuscript || doc.paragraphs }) }) }) }));
  const title = (output.title || doc.title).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + title + "</title><style>" + css.replaceAll("</style", "<\\/style") + "\nbody{margin:0;background:#151b18}.ar-output-reader{margin:0 auto}@media print{body{background:white}.ar-output-reader{max-width:none}}</style>" + html + "</html>";
}
export {
  outputHtml,
  outputMarkdown
};
