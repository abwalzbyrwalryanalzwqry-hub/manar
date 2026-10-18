/* منار — رسم «فنّ الويدجت» بخطوط التطبيق على canvas (انظر art-spec.ts).
 *
 * الناتج: صفائح PNG (نصّ أبيض على شفاف — يُلوّنه الأصلي حسب النمط) وفهرس JSON
 * بمواضع كل كلمة وحرف وفقرة. يعمل في المتصفّح فقط.
 */

import {
  ART_SPEC_VERSION,
  DIGIT_CHARS,
  LINE_STYLES,
  PARA_STYLES,
  artHash,
  type ArtRequest,
  type LineStyleId,
  type ParaStyleId,
} from "./art-spec";

export const SHEET_SIZE = 2048;

/** [صفيحة، x، y، عرض الصورة، التقدّم الأفقي، الحشوة اليمنى/اليسرى] */
export type GlyphRect = [number, number, number, number, number, number];
/** [صفيحة، x، y، عرض، ارتفاع] */
export type ParaRect = [number, number, number, number, number];

export interface ArtLineIndex {
  px: number;
  /** ارتفاع صورة السطر وموضع خط الأساس فيها (بكسل). */
  h: number;
  base: number;
  /** عرض المسافة بين الكلمات. */
  space: number;
  g: Record<string, GlyphRect>;
}

export interface ArtIndex {
  v: number;
  hash: string;
  /** «thmanyah» إن رُسم بخط ثمانية، وإلا «fallback». */
  sig: string;
  sheets: number;
  lines: Record<LineStyleId, ArtLineIndex>;
  paras: Record<string, ParaRect>;
}

export interface ArtPack {
  index: ArtIndex;
  /** PNG بترميز base64 دون البادئة. */
  sheets: string[];
}

function cssFamily(variable: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v || "sans-serif";
}

/** توقيع الخطوط المتاحة: يتغيّر إن ثُبّت خط ثمانية لاحقاً فيُعاد الرسم. */
export async function fontsSignature(): Promise<string> {
  try {
    await document.fonts.load('700 20px "Thmanyah Sans"', "منار");
    return document.fonts.check('700 20px "Thmanyah Sans"', "منار") ? "thmanyah" : "fallback";
  } catch {
    return "fallback";
  }
}

async function ensureFont(font: string, sample: string) {
  try {
    await document.fonts.load(font, sample);
  } catch {
    /* البديل يُستعمل تلقائياً */
  }
}

interface Item {
  kind: "g" | "p";
  style: string;
  key: string;
  w: number;
  h: number;
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  rect?: { s: number; x: number; y: number };
}

/** رصّ على رفوف: يكفي لصور متقاربة الارتفاع، ويُبقي الكود بسيطاً. */
function pack(items: Item[]): number {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w);
  let sheet = 0;
  let x = 0;
  let y = 0;
  let shelf = 0;
  const gap = 2;
  for (const it of sorted) {
    const w = Math.min(it.w, SHEET_SIZE);
    if (x + w > SHEET_SIZE) {
      x = 0;
      y += shelf + gap;
      shelf = 0;
    }
    if (y + it.h > SHEET_SIZE) {
      sheet += 1;
      x = 0;
      y = 0;
      shelf = 0;
    }
    it.rect = { s: sheet, x, y };
    x += w + gap;
    shelf = Math.max(shelf, it.h);
  }
  return items.length ? sheet + 1 : 0;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(next).width > width) {
        out.push(line);
        line = w;
      } else line = next;
    }
    if (line) out.push(line);
  }
  return out;
}

/** يرسم الحزمة كاملة. `req` من `collectArt`. */
export async function renderArtPack(req: ArtRequest): Promise<ArtPack> {
  const sig = await fontsSignature();
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("canvas unavailable");

  const items: Item[] = [];
  const lines = {} as Record<LineStyleId, ArtLineIndex>;

  for (const id of Object.keys(LINE_STYLES) as LineStyleId[]) {
    const st = LINE_STYLES[id];
    const font = `${st.weight} ${st.px}px ${cssFamily(st.family)}`;
    await ensureFont(font, "منار ٠١٢٣ أبجد");
    measure.font = font;
    measure.direction = "rtl";
    const m = measure.measureText("أبجد هوز ٠١٢٣");
    const asc = Math.ceil(m.fontBoundingBoxAscent || st.px * 1.1);
    const desc = Math.ceil(m.fontBoundingBoxDescent || st.px * 0.5);
    const pad = Math.ceil(st.px * 0.12);
    const h = asc + desc + 4;
    const base = asc + 2;
    const space = measure.measureText(" ").width;
    lines[id] = { px: st.px, h, base, space: Math.round(space * 100) / 100, g: {} };

    const tokens = new Set<string>(st.digitsOnly ? [] : req.lines[id]);
    for (const ch of DIGIT_CHARS) tokens.add(ch);
    for (const t of tokens) {
      const adv = measure.measureText(t).width;
      const w = Math.ceil(adv) + pad * 2;
      items.push({
        kind: "g",
        style: id,
        key: t,
        w,
        h,
        draw: (ctx, x, y) => {
          ctx.font = font;
          ctx.direction = "rtl";
          ctx.textAlign = "right";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(t, x + pad + adv, y + base);
        },
      });
      lines[id].g[t] = [0, 0, 0, w, Math.round(adv * 100) / 100, pad];
    }
  }

  const paras: Record<string, ParaRect> = {};
  for (const [key, p] of req.paras) {
    const st = PARA_STYLES[p.style as ParaStyleId];
    const font = `${st.weight} ${st.px}px ${cssFamily(st.family)}`;
    await ensureFont(font, p.text.slice(0, 40));
    measure.font = font;
    measure.direction = "rtl";
    const rows = wrapLines(measure, p.text, st.width);
    const lh = st.px * st.lineHeight;
    const widest = Math.max(...rows.map((r) => measure.measureText(r).width), 1);
    const pad = Math.ceil(st.px * 0.2);
    const w = Math.min(SHEET_SIZE, Math.ceil(widest) + pad * 2);
    const h = Math.min(SHEET_SIZE, Math.ceil(rows.length * lh + pad));
    const centered = p.style === "Q";
    items.push({
      kind: "p",
      style: p.style,
      key,
      w,
      h,
      draw: (ctx, x, y) => {
        ctx.font = font;
        ctx.direction = "rtl";
        ctx.textBaseline = "middle";
        ctx.textAlign = centered ? "center" : "right";
        const tx = centered ? x + w / 2 : x + w - pad;
        rows.forEach((r, i) => ctx.fillText(r, tx, y + pad / 2 + lh * (i + 0.5)));
      },
    });
    paras[key] = [0, 0, 0, w, h];
  }

  const sheetCount = pack(items);
  const canvases: HTMLCanvasElement[] = [];
  for (let s = 0; s < sheetCount; s += 1) {
    const used = items.filter((it) => it.rect?.s === s);
    const height = Math.max(...used.map((it) => (it.rect?.y ?? 0) + it.h), 1);
    const c = document.createElement("canvas");
    c.width = SHEET_SIZE;
    c.height = Math.min(SHEET_SIZE, height);
    canvases.push(c);
  }
  const ctxs = canvases.map((c) => {
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.fillStyle = "#ffffff";
    return ctx;
  });
  for (const it of items) {
    const r = it.rect!;
    it.draw(ctxs[r.s], r.x, r.y);
    if (it.kind === "g") {
      const g = lines[it.style as LineStyleId].g[it.key];
      g[0] = r.s;
      g[1] = r.x;
      g[2] = r.y;
    } else {
      const p = paras[it.key];
      p[0] = r.s;
      p[1] = r.x;
      p[2] = r.y;
    }
  }
  const sheets = canvases.map((c) =>
    c.toDataURL("image/png").replace(/^data:image\/png;base64,/, ""),
  );
  return {
    index: {
      v: ART_SPEC_VERSION,
      hash: artHash(req, sig),
      sig,
      sheets: sheets.length,
      lines,
      paras,
    },
    sheets,
  };
}
