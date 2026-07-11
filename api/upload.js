import formidable from "formidable";
import fs from "fs";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "./_r2.js";
import { verifyAdmin } from "./_auth.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ADMIN CHECK
  try {
    verifyAdmin(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
    });

    const [, files] = await form.parse(req);

    const file = files.file?.[0] || files.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: "Invalid file type.",
      });
    }

    const extension = file.originalFilename.split(".").pop();

    const key = `${crypto.randomUUID()}.${extension}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: fs.createReadStream(file.filepath),
        ContentType: file.mimetype,
      })
    );

    const url = `${process.env.R2_PUBLIC_URL}/${key}`;

    return res.status(200).json({
      url,
      pathname: key,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message,
    });
  }
}