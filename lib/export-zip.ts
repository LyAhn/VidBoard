import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { FrameData } from "@/lib/vidboard-types";

interface ExportZipOptions {
  artistName: string;
  trackTitle: string;
  frames: FrameData[];
}

export const exportStoryboardZip = async ({
  artistName,
  trackTitle,
  frames,
}: ExportZipOptions) => {
  if (!frames.length) return;

  const fetchBlob = async (path: string): Promise<Blob | null> => {
    try {
      const res = await fetch(`/api/images/${path}`);
      return res.ok ? res.blob() : null;
    } catch {
      return null;
    }
  };

  const mimeToExt = (mime: string) =>
    mime.toLowerCase().includes("jpeg") || mime.toLowerCase().includes("jpg") ? "jpg" : "png";

  const resolveBlob = async (base64?: string, path?: string): Promise<Blob | null> => {
    if (base64) {
      try {
        const match = base64.match(/^data:(image\/(?:png|jpe?g));base64,(.+)$/i);
        const mime = match ? match[1].toLowerCase().replace("image/jpg", "image/jpeg") : "image/png";
        const clean = match ? match[2] : base64;
        const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
        return new Blob([bytes], { type: mime });
      } catch {
        return null;
      }
    }
    if (path) return fetchBlob(path);
    return null;
  };

  const zip = new JSZip();
  await Promise.all(
    frames.map(async (frame, index) => {
      const pad = String(index + 1).padStart(2, "0");
      const [startBlob, endBlob] = await Promise.all([
        resolveBlob(frame.startImageBase64, frame.startImagePath),
        resolveBlob(frame.endImageBase64, frame.endImagePath),
      ]);
      if (startBlob) zip.file(`Frame_${pad}_Start.${mimeToExt(startBlob.type)}`, startBlob);
      if (endBlob) zip.file(`Frame_${pad}_End.${mimeToExt(endBlob.type)}`, endBlob);
    })
  );

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${artistName}_${trackTitle}_Storyboard.zip`.replace(/\s+/g, "_"));
};
