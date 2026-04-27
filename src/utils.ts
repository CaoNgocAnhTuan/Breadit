import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export type UploadResult = {
  filePath: string;
  height: number;
  fileType: "image" | "video";
};

export async function uploadFile(
  file: File,
  imgType: "original" | "square" | "wide"
): Promise<UploadResult> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  const isImage = file.type.startsWith("image/");

  if (isImage) {
    let pipeline = sharp(buffer).resize({ width: 600, withoutEnlargement: true });
    if (imgType === "square") {
      pipeline = sharp(buffer).resize(600, 600, { fit: "cover" });
    } else if (imgType === "wide") {
      pipeline = sharp(buffer).resize(600, 338, { fit: "cover" });
    }
    const out = await pipeline.jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
    const name = `${randomUUID()}.jpg`;
    await fs.writeFile(path.join(UPLOAD_DIR, name), out.data);
    return { filePath: `/uploads/${name}`, height: out.info.height, fileType: "image" };
  }

  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const name = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return { filePath: `/uploads/${name}`, height: 0, fileType: "video" };
}
