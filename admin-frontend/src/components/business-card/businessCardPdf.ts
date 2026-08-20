import { businessCardTemplate, type BusinessCardDetails, type CardSide } from "./businessCardTemplates";

const ascii = (value: string) => new TextEncoder().encode(value);
const join = (chunks: Uint8Array[]) => {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => { output.set(chunk, offset); offset += chunk.length; });
  return output;
};

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error("Business-card template could not be loaded"));
  image.src = src;
});

async function renderSide(image: HTMLImageElement, side: CardSide, details: BusinessCardDetails) {
  const canvas = document.createElement("canvas");
  canvas.width = side.crop.width;
  canvas.height = side.crop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PDF canvas is unavailable");
  ctx.drawImage(image, side.crop.x, side.crop.y, side.crop.width, side.crop.height, 0, 0, side.crop.width, side.crop.height);
  side.masks.forEach((mask) => { ctx.fillStyle = mask.color; ctx.fillRect(mask.x, mask.y, mask.width, mask.height); });
  side.texts.forEach((text) => {
    const value = `${text.prefix || ""}${details[text.field] || "—"}`;
    let size = text.size;
    const maxWidth = text.maxWidth ?? (side.masks[0] ? side.masks[0].width - 20 : side.crop.width * 0.75);
    do {
      ctx.font = `${text.weight} ${size}px Arial, sans-serif`;
      if (ctx.measureText(value).width <= maxWidth || size <= 14) break;
      size -= 1;
    } while (size > 13);
    ctx.fillStyle = text.color;
    ctx.textAlign = text.anchor === "middle" ? "center" : text.anchor === "end" ? "right" : "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(value, text.x, text.y);
  });
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Card image could not be generated")), "image/jpeg", 0.96));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}

export function makePdf(images: Array<{ bytes: Uint8Array; width: number; height: number }>) {
  const objectCount = 2 + images.length * 3;
  const objects = new Map<number, Uint8Array>();
  const pageRefs = images.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
  objects.set(1, ascii("<< /Type /Catalog /Pages 2 0 R >>"));
  objects.set(2, ascii(`<< /Type /Pages /Kids [${pageRefs}] /Count ${images.length} >>`));

  images.forEach((image, index) => {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const pageWidth = 252;
    const pageHeight = Number((pageWidth * image.height / image.width).toFixed(2));
    const content = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Card Do Q`;
    objects.set(pageId, ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Card ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
    objects.set(imageId, join([
      ascii(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`),
      image.bytes,
      ascii("\nendstream"),
    ]));
    objects.set(contentId, ascii(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  });

  const chunks: Uint8Array[] = [ascii("%PDF-1.4\n")];
  const offsets = [0];
  let length = chunks[0].length;
  for (let id = 1; id <= objectCount; id += 1) {
    const chunk = join([ascii(`${id} 0 obj\n`), objects.get(id)!, ascii("\nendobj\n")]);
    offsets[id] = length;
    chunks.push(chunk);
    length += chunk.length;
  }
  const xrefOffset = length;
  const xref = [`xref\n0 ${objectCount + 1}\n`, "0000000000 65535 f \n"];
  for (let id = 1; id <= objectCount; id += 1) xref.push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  chunks.push(ascii(`${xref.join("")}trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return join(chunks);
}

export async function downloadBusinessCardPdf(details: BusinessCardDetails) {
  const template = businessCardTemplate(details.brand);
  const sides = await Promise.all(template.sides.map(async (side) =>
    renderSide(await loadImage(side.image || template.image), side, details)));
  const url = URL.createObjectURL(new Blob([makePdf(sides)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${template.name}-${details.name || "business-card"}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() + ".pdf";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
