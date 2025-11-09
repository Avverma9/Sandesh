// uploads/s3Upload.mjs
import path from "path";
import crypto from "crypto";
import multer from "multer";
import multerS3 from "multer-s3";
import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";

dotenv.config({ quiet: true });

const {
  AWS_BUCKET_NAME,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
} = process.env;

// Basic env guard (fail fast in dev)
if (!AWS_BUCKET_NAME || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
  throw new Error("Missing AWS S3 environment variables. Check AWS_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION.");
}

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// Allowed extensions & mimetypes (extend as needed)
const allowedExt = /\.(jpeg|jpg|png|gif|pdf|docx|mp4|mp3|webm)$/i;
const allowedMime = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4",
  "audio/mpeg",       // mp3
  "video/webm",
];

// Unique, safe object key
function buildObjectKey(file) {
  const ext = path.extname(file.originalname) || "";
  const base = path.basename(file.originalname, ext).replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "");
  const rand = crypto.randomBytes(6).toString("hex");
  // Optional prefix folder (e.g., "uploads/")
  return `${Date.now()}-${rand}-${base}${ext.toLowerCase()}`;
}

const storage = multerS3({
  s3,
  bucket: AWS_BUCKET_NAME,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  // If you want public URLs, keep public-read. Otherwise remove ACL and use signed URLs.
  acl: "public-read",
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    cb(null, buildObjectKey(file));
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const extOk = allowedExt.test(file.originalname);
    const mimeOk = allowedMime.includes(file.mimetype);
    if (!extOk || !mimeOk) return cb(new Error("Invalid file type"));
    cb(null, true);
  },
});

// Optional helpers for routes:
// Single file: upload.single("file")
// Multiple files: upload.array("files", 5)
// Fields: upload.fields([{ name: "avatar", maxCount: 1 }, { name: "docs", maxCount: 3 }])

