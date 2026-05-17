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

  const resolveBlob = async (base64?: string, path?: string): Promise<Blob | null> => {
    if (base64) {
      const clean = base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
      const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
      return new Blob([bytes], { type: "image/png" });
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
      if (startBlob) zip.file(`Frame_${pad}_Start.png`, startBlob);
      if (endBlob) zip.file(`Frame_${pad}_End.png`, endBlob);
    })
  );

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${artistName}_${trackTitle}_Storyboard.zip`.replace(/\s+/g, "_"));
};
