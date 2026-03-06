// JobHub/components/pdf2/pdfWriter.ts

import { PDFDocument, rgb } from "pdf-lib";
import * as FileSystem from "expo-file-system/legacy";

/**
 * Draw a rectangle onto an existing PDF.
 * Returns the path to the new edited PDF.
 */
export async function drawBoxOnPdf(
  localPdfPath: string,
  normalizedX: number,
  normalizedY: number,
  normalizedWidth: number,
  normalizedHeight: number
) {
  // read local PDF
  const pdfBase64 = await FileSystem.readAsStringAsync(localPdfPath, {
    encoding: "base64",
  });

  // convert base64 → Uint8Array
  const binary = atob(pdfBase64);
  const pdfBytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    pdfBytes[i] = binary.charCodeAt(i);
  }

  console.log("🧾 pdf-lib LOAD start");
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

const rot = page.getRotation?.()?.angle ?? "(no getRotation)";
const media = page.getMediaBox?.();
const crop = page.getCropBox?.();

console.log("🧾 PDF-LIB PAGE META (BOX)", {
  size: { width, height },
  rotation: rot,
  mediaBox: media
    ? { x: media.x, y: media.y, w: media.width, h: media.height }
    : null,
  cropBox: crop
    ? { x: crop.x, y: crop.y, w: crop.width, h: crop.height }
    : null,
});
console.log("🧾 PDF page size:", { width, height });

  // convert normalized coords → PDF coords
  const x = normalizedX * width;
  const y = height - normalizedY * height - normalizedHeight * height;

  const boxWidth = normalizedWidth * width;
  const boxHeight = normalizedHeight * height;

  page.drawRectangle({
    x,
    y,
    width: boxWidth,
    height: boxHeight,
    color: rgb(1, 0, 0),
    opacity: 0.35,
  });

  console.log("🧾 pdf-lib SAVE start");

const newPdfBytes = await pdfDoc.save();

console.log("🧾 pdf-lib SAVE done");

  // convert bytes → base64
  let binaryString = "";
  const bytes = new Uint8Array(newPdfBytes);

  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }

  const newBase64 = btoa(binaryString);

  // access directory safely for TypeScript
  const baseDir = (FileSystem as any).cacheDirectory;

  const newPath = baseDir + "edited-" + Date.now() + ".pdf";

  await FileSystem.writeAsStringAsync(newPath, newBase64, {
    encoding: "base64",
  });

  return newPath;
}

export async function drawPathOnPdf(
  localPdfPath: string,
  path: string
) {
  const pdfBase64 = await FileSystem.readAsStringAsync(localPdfPath, {
    encoding: "base64",
  });

  const binary = atob(pdfBase64);
  const pdfBytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    pdfBytes[i] = binary.charCodeAt(i);
  }

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

const rot = page.getRotation?.()?.angle ?? "(no getRotation)";
const media = page.getMediaBox?.();
const crop = page.getCropBox?.();

console.log("🧾 PDF-LIB PAGE META", {
  size: { width, height },
  rotation: rot,
  mediaBox: media
    ? { x: media.x, y: media.y, w: media.width, h: media.height }
    : null,
  cropBox: crop
    ? { x: crop.x, y: crop.y, w: crop.width, h: crop.height }
    : null,
});

  // convert SVG path → segmented strokes
  const commands = path.split(" ");
  const segments: { x: number; y: number }[][] = [];

  let current: { x: number; y: number }[] = [];

  for (let i = 0; i < commands.length; i++) {
    if (commands[i] === "M" || commands[i] === "L") {
      const [x, y] = commands[i + 1].split(",");

      const nx = parseFloat(x);
      const ny = parseFloat(y);

      const px = nx * width;
      const py = height - ny * height;

      const crop = page.getCropBox?.();

      if (segments.length < 3) {
        console.log("🧾 MAP PT", {
          norm: { nx, ny },
          media: { x: px, y: py },
          crop: crop
            ? {
                x: crop.x + nx * crop.width,
                y: crop.y + (1 - ny) * crop.height,
              }
            : null,
        });
      }

      const pt = { x: px, y: py };

      if (commands[i] === "M") {
        if (current.length > 0) {
          segments.push(current);
        }
        current = [pt];
      } else {
        current.push(pt);
      }
    }
  }

  if (current.length > 0) {
    segments.push(current);
  }

  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) {
      page.drawLine({
        start: seg[i - 1],
        end: seg[i],
        thickness: 2,
        color: rgb(1, 0, 0),
        opacity: 0.9,
      });
    }
  }

  const newPdfBytes = await pdfDoc.save();

  let binaryString = "";
  const bytes = new Uint8Array(newPdfBytes);

  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }

  const newBase64 = btoa(binaryString);

  const baseDir =
    (FileSystem as any)["cacheDirectory"] ||
    (FileSystem as any)["documentDirectory"];

  const newPath = baseDir + "edited-" + Date.now() + ".pdf";

  await FileSystem.writeAsStringAsync(newPath, newBase64, {
    encoding: "base64",
  });

  return newPath;
}