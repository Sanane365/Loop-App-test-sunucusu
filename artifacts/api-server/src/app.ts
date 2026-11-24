import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import fs from "node:fs";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./middlewares/sessionMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

const uploadDir = path.resolve(import.meta.dirname, "..", "uploads");
const decorationDir = path.join(uploadDir, "decorations");

function getExtensionlessDecorationMimeType(filePath: string): string | null {
  const descriptor = fs.openSync(filePath, "r");
  const header = Buffer.alloc(512);
  let bytesRead: number;
  try {
    bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }

  const bytes = header.subarray(0, bytesRead);
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 6).toString("ascii").match(/^GIF8[79]a$/)) return "image/gif";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.subarray(0, 2).toString("ascii") === "BM") return "image/bmp";
  if (bytes.subarray(4, 12).toString("ascii").match(/^ftyp(?:avif|avis)$/)) return "image/avif";
  if (/^(?:<\?xml[\s\S]*?\?>\s*)?<svg(?:\s|>)/i.test(bytes.toString("utf8").replace(/^\uFEFF/, "").trimStart())) return "image/svg+xml";
  return null;
}

app.use("/api/uploads", express.static(uploadDir, {
  setHeaders(res, filePath) {
    const relativePath = path.relative(decorationDir, filePath);
    if (
      path.extname(filePath)
      || relativePath === ".."
      || relativePath.startsWith(`..${path.sep}`)
      || path.isAbsolute(relativePath)
    ) return;

    const contentType = getExtensionlessDecorationMimeType(filePath);
    if (!contentType) return;
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
  },
}));
app.use("/uploads", express.static(uploadDir));

app.use("/api", router);
app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint not found" }));

const frontendBuildDir = path.resolve(import.meta.dirname, "..", "..", "loop-app", "dist", "public");
app.use(express.static(frontendBuildDir));
app.get(/.*/, (_req, res, next) => {
  const indexPath = path.join(frontendBuildDir, "index.html");
  if (!fs.existsSync(indexPath)) return next();
  res.sendFile(indexPath, error => {
    if (error) next(error);
  });
});

export default app;
