import { makePdf } from "../business-card/businessCardPdf";
import { visionIndiaIdCardSvg, type IdCardDetails, type IdCardSide } from "./visionIndiaIdCard";

const load = (side: IdCardSide, details: IdCardDetails) => new Promise<{ image: HTMLImageElement; url: string }>((resolve, reject) => {
  const source = URL.createObjectURL(new Blob([visionIndiaIdCardSvg(side, details)], { type: "image/svg+xml" }));
  const image = new Image();
  image.onload = () => resolve({ image, url: source });
  image.onerror = () => { URL.revokeObjectURL(source); reject(new Error("ID-card template could not be loaded")); };
  image.src = source;
});

export async function downloadIdCardPdf(details: IdCardDetails) {
  const sides = await Promise.all((["front", "back"] as IdCardSide[]).map((side) => load(side, details)));
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 3500;
  const context = canvas.getContext("2d"); if (!context) throw new Error("ID-card PDF canvas is unavailable");
  context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
  sides.forEach(({ image }, index) => context.drawImage(image, 0, index * 1780, 1080, 1720));
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("ID-card PDF could not be generated")), "image/jpeg", .97));
  sides.forEach(({ url }) => URL.revokeObjectURL(url));
  const sheet = { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
  const url = URL.createObjectURL(new Blob([makePdf([sheet])], { type: "application/pdf" }));
  const link = document.createElement("a"); link.href = url;
  link.download = `vision-india-id-${details.employeeCode || details.name}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() + ".pdf";
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
