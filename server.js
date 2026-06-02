const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3847;
const HOST = process.env.HOST || "0.0.0.0";

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const net of ifaces) {
      const v4 = net.family === "IPv4" || net.family === 4;
      if (v4 && !net.internal) return net.address;
    }
  }
  return null;
}

function resolvePublicUrl() {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/$/, "");
  }
  const lan = getLanIp();
  if (lan) return `http://${lan}:${PORT}`;
  return `http://localhost:${PORT}`;
}

const PUBLIC_URL = resolvePublicUrl();
const LAN_IP = getLanIp();
const USES_LOCALHOST =
  PUBLIC_URL.includes("localhost") || PUBLIC_URL.includes("127.0.0.1");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const PUBLIC_DIR = path.join(ROOT, "public");

for (const dir of [DATA_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const MAX_TEXT = 2000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** extension (no dot) -> { mime, category } */
const FILE_TYPES = {
  // Images
  jpg: { mime: "image/jpeg", category: "image" },
  jpeg: { mime: "image/jpeg", category: "image" },
  png: { mime: "image/png", category: "image" },
  gif: { mime: "image/gif", category: "image" },
  webp: { mime: "image/webp", category: "image" },
  bmp: { mime: "image/bmp", category: "image" },
  svg: { mime: "image/svg+xml", category: "image" },
  ico: { mime: "image/x-icon", category: "image" },
  heic: { mime: "image/heic", category: "image" },
  heif: { mime: "image/heif", category: "image" },
  // PDF
  pdf: { mime: "application/pdf", category: "pdf" },
  // Video
  mp4: { mime: "video/mp4", category: "video" },
  webm: { mime: "video/webm", category: "video" },
  mov: { mime: "video/quicktime", category: "video" },
  avi: { mime: "video/x-msvideo", category: "video" },
  mkv: { mime: "video/x-matroska", category: "video" },
  m4v: { mime: "video/x-m4v", category: "video" },
  // Audio
  mp3: { mime: "audio/mpeg", category: "audio" },
  wav: { mime: "audio/wav", category: "audio" },
  ogg: { mime: "audio/ogg", category: "audio" },
  m4a: { mime: "audio/mp4", category: "audio" },
  aac: { mime: "audio/aac", category: "audio" },
  flac: { mime: "audio/flac", category: "audio" },
  // Documents
  txt: { mime: "text/plain", category: "document" },
  csv: { mime: "text/csv", category: "document" },
  json: { mime: "application/json", category: "document" },
  xml: { mime: "application/xml", category: "document" },
  md: { mime: "text/markdown", category: "document" },
  rtf: { mime: "application/rtf", category: "document" },
  doc: { mime: "application/msword", category: "document" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    category: "document",
  },
  xls: { mime: "application/vnd.ms-excel", category: "document" },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    category: "document",
  },
  ppt: { mime: "application/vnd.ms-powerpoint", category: "document" },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    category: "document",
  },
  odt: { mime: "application/vnd.oasis.opendocument.text", category: "document" },
  ods: { mime: "application/vnd.oasis.opendocument.spreadsheet", category: "document" },
  odp: { mime: "application/vnd.oasis.opendocument.presentation", category: "document" },
  epub: { mime: "application/epub+zip", category: "document" },
  // Archives
  zip: { mime: "application/zip", category: "archive" },
  rar: { mime: "application/vnd.rar", category: "archive" },
  "7z": { mime: "application/x-7z-compressed", category: "archive" },
};

const BLOCKED_EXT = new Set([
  "exe", "bat", "cmd", "com", "msi", "dll", "scr", "vbs", "ps1", "sh",
  "js", "mjs", "cjs", "html", "htm", "php", "asp", "aspx", "jar", "apk",
]);

function getExt(filename) {
  const i = filename.lastIndexOf(".");
  if (i < 0) return "";
  return filename.slice(i + 1).toLowerCase();
}

function resolveFileType(originalname, mimetype) {
  const ext = getExt(originalname);
  if (!ext) return null;
  if (BLOCKED_EXT.has(ext)) return null;

  const known = FILE_TYPES[ext];
  if (known) return { ext, ...known };

  // Fallback: trust browser mime for broad families
  if (mimetype) {
    if (mimetype.startsWith("image/")) {
      return { ext, mime: mimetype, category: "image" };
    }
    if (mimetype.startsWith("video/")) {
      return { ext, mime: mimetype, category: "video" };
    }
    if (mimetype.startsWith("audio/")) {
      return { ext, mime: mimetype, category: "audio" };
    }
    if (mimetype === "application/pdf") {
      return { ext, mime: mimetype, category: "pdf" };
    }
    if (mimetype.startsWith("text/")) {
      return { ext, mime: mimetype, category: "document" };
    }
  }

  return { ext, mime: mimetype || "application/octet-stream", category: "file" };
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = getExt(file.originalname);
    const safe = ext.replace(/[^a-z0-9]/g, "");
    cb(null, `${uuidv4()}${safe ? "." + safe : ""}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    const info = resolveFileType(file.originalname, file.mimetype);
    if (!info) {
      return cb(
        new Error(
          "File type not allowed. Use images, PDF, video, audio, documents, or ZIP — not programs (.exe, .js, etc.)."
        )
      );
    }
    cb(null, true);
  },
});

function dbPath(id) {
  return path.join(DATA_DIR, `${id}.json`);
}

function readEntry(id) {
  const p = dbPath(id);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeEntry(entry) {
  fs.writeFileSync(dbPath(entry.id), JSON.stringify(entry, null, 2), "utf8");
}

function viewUrl(id) {
  return `${PUBLIC_URL}/v/${id}`;
}

function fileUrl(filename) {
  return `${PUBLIC_URL}/uploads/${encodeURIComponent(filename)}`;
}

/** What goes inside the QR — images open as the photo, not a localhost page label */
function qrPayloadForEntry(entry) {
  if (entry.type === "image") return fileUrl(entry.filename);
  if (entry.type === "pdf") return fileUrl(entry.filename);
  if (entry.type === "video" || entry.type === "audio") return fileUrl(entry.filename);
  return viewUrl(entry.id);
}

app.use(express.json({ limit: "32kb" }));
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    publicUrl: PUBLIC_URL,
    lanIp: LAN_IP,
    usesLocalhost: USES_LOCALHOST,
    scanReady: !USES_LOCALHOST,
    maxFileMb: MAX_FILE_BYTES / (1024 * 1024),
  });
});

app.get("/api/formats", (_req, res) => {
  const extensions = Object.keys(FILE_TYPES).sort();
  const categories = [...new Set(Object.values(FILE_TYPES).map((t) => t.category))];
  res.json({ extensions, categories, maxFileMb: MAX_FILE_BYTES / (1024 * 1024) });
});

app.post("/api/create/text", (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) {
    return res.status(400).json({ error: "Text is required." });
  }
  if (text.length > MAX_TEXT) {
    return res.status(400).json({ error: `Text must be ${MAX_TEXT} characters or less.` });
  }

  const id = uuidv4().slice(0, 8);
  const entry = {
    id,
    type: "text",
    text,
    title: (req.body?.title || "").trim().slice(0, 120) || "Text",
    createdAt: new Date().toISOString(),
  };
  writeEntry(entry);

  const url = viewUrl(id);
  const embedInQr = text.length <= 280;

  res.json({
    id,
    type: "text",
    viewUrl: url,
    embedInQr,
    qrPayload: embedInQr ? text : url,
  });
});

app.post("/api/create/file", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const info = resolveFileType(req.file.originalname, req.file.mimetype);
  if (!info) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "File type not allowed." });
  }

  const id = uuidv4().slice(0, 8);
  const entry = {
    id,
    type: info.category,
    ext: info.ext,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mime: info.mime,
    size: req.file.size,
    title:
      (req.body?.title || "").trim().slice(0, 120) ||
      req.file.originalname ||
      "File",
    createdAt: new Date().toISOString(),
  };
  writeEntry(entry);

  const pageUrl = viewUrl(id);
  const scanUrl = qrPayloadForEntry(entry);
  res.json({
    id,
    type: entry.type,
    ext: entry.ext,
    viewUrl: pageUrl,
    scanUrl,
    embedInQr: false,
    qrPayload: scanUrl,
    opensDirectly: entry.type === "image",
    originalName: entry.originalName,
  });
});

app.get("/api/entry/:id", (req, res) => {
  const entry = readEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: "Not found." });
  // Back-compat: old entries used type "image" only
  if (entry.type === "image" || entry.mime?.startsWith("image/")) {
    entry.type = entry.type === "image" ? "image" : entry.type;
  }
  res.json(entry);
});

app.get("/api/qr/:id.png", async (req, res) => {
  const payload = (req.query.payload || "").trim();
  const entry = readEntry(req.params.id);
  let data = payload;

  if (!data && entry) {
    if (entry.type === "text" && entry.text && entry.text.length <= 280) {
      data = entry.text;
    } else {
      data = qrPayloadForEntry(entry);
    }
  }

  if (!data) {
    return res.status(400).json({ error: "Missing QR payload." });
  }

  try {
    const png = await QRCode.toBuffer(data, {
      type: "png",
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    });
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(png);
  } catch {
    res.status(500).json({ error: "Could not generate QR code." });
  }
});

app.get("/v/:id", (req, res) => {
  const entry = readEntry(req.params.id);
  if (!entry) {
    return res.status(404).sendFile(path.join(PUBLIC_DIR, "not-found.html"));
  }
  res.sendFile(path.join(PUBLIC_DIR, "view.html"));
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: `File is too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB).`,
      });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || "Upload failed." });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`QR Studio running at http://localhost:${PORT}`);
  console.log(`QR scan URL (use this on your phone): ${PUBLIC_URL}`);
  if (USES_LOCALHOST) {
    console.log(`WARNING: No LAN IP found. Phones cannot open localhost — connect Wi‑Fi or set PUBLIC_URL.`);
  } else if (LAN_IP) {
    console.log(`Phone & PC must be on the same Wi‑Fi. Allow port ${PORT} in Windows Firewall if scan fails.`);
  }
});
