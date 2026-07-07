import type { FastifyInstance, FastifyReply } from "fastify";
import { assertSchoolAccess, requireRoles } from "../plugins/auth.js";
import { createUpload } from "../services/upload-service.js";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const SUPPORTED_EXT = /\.(csv|xlsx|xls)$/i;
const WINDOWS = new Set(["BOY", "MOY", "EOY"]);

interface UploadMeta {
  filename?: string;
  fileSizeBytes?: number;
  rowCount?: number;
  columnCount?: number;
  headers?: string[];
  assessmentWindow?: string;
  schoolId?: string;
  assessmentTypeOverride?: string;
}

function fail(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } });
}

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  // FR-001: only the three admin roles reach the assessment area.
  const guard = requireRoles("SCHOOL_ADMIN", "DISTRICT_ADMIN", "IGNITE_ADMIN");

  app.post("/uploads", { preHandler: guard }, async (req, reply) => {
    let fileBuffer: Buffer | null = null;
    let filename = "";
    let truncated = false;
    let metaRaw: string | undefined;

    try {
      for await (const part of req.parts()) {
        if (part.type === "file") {
          filename = part.filename;
          try {
            fileBuffer = await part.toBuffer();
          } catch {
            truncated = true;
          }
          if (part.file?.truncated) truncated = true;
        } else if (part.fieldname === "meta") {
          metaRaw = part.value as string;
        }
      }
    } catch (err) {
      return fail(reply, 400, "BAD_UPLOAD", `The upload could not be read: ${(err as Error).message}`);
    }

    if (truncated) {
      return fail(reply, 400, "FILE_TOO_LARGE", "File too large. The maximum upload size is 50MB.");
    }
    if (!metaRaw) {
      return fail(reply, 400, "BAD_UPLOAD", "The upload metadata is missing.");
    }
    let meta: UploadMeta;
    try {
      meta = JSON.parse(metaRaw);
    } catch {
      return fail(reply, 400, "BAD_UPLOAD", "The upload metadata is not valid JSON.");
    }

    if (!meta.schoolId) return fail(reply, 400, "BAD_UPLOAD", "A school is required for the upload.");
    if (!meta.assessmentWindow || !WINDOWS.has(meta.assessmentWindow)) {
      return fail(reply, 400, "BAD_UPLOAD", "Select a benchmark period (BOY, MOY, or EOY) before uploading.");
    }
    if (!Array.isArray(meta.headers) || meta.headers.length === 0) {
      return fail(reply, 400, "EMPTY_FILE", "The file has no columns. Confirm the file has a header row.");
    }

    // Role/school scope (403 SCHOOL_SCOPE).
    if (!assertSchoolAccess(req, reply, meta.schoolId)) return reply;

    if (!SUPPORTED_EXT.test(filename)) {
      return fail(reply, 400, "UNSUPPORTED_TYPE", "Unsupported file type. Upload a .csv, .xlsx, or .xls file.");
    }

    const declaredSize = meta.fileSizeBytes ?? fileBuffer?.length ?? 0;
    const actualSize = fileBuffer?.length ?? 0;
    if (actualSize === 0 && declaredSize === 0) {
      return fail(reply, 400, "EMPTY_FILE", "The file is empty. Choose a file with data.");
    }
    if (declaredSize > MAX_FILE_BYTES || actualSize > MAX_FILE_BYTES) {
      return fail(reply, 400, "FILE_TOO_LARGE", "File too large. The maximum upload size is 50MB.");
    }

    const ext = filename.slice(filename.lastIndexOf(".") + 1);
    const result = await createUpload(
      { storage: app.services.storage },
      {
        session: req.session!,
        file: { filename, ext, buffer: fileBuffer ?? Buffer.alloc(0), sizeBytes: declaredSize },
        meta: {
          rowCount: meta.rowCount ?? 0,
          columnCount: meta.columnCount ?? meta.headers.length,
          headers: meta.headers,
          assessmentWindow: meta.assessmentWindow,
          schoolId: meta.schoolId,
          assessmentTypeOverride: meta.assessmentTypeOverride,
        },
      },
    );

    return reply.code(201).send({
      uploadId: result.uploadId,
      detection: {
        detected: result.detection.detected,
        confidence: result.detection.confidence,
        ambiguous: result.detection.ambiguous,
        scores: result.detection.scores,
        ranked: result.detection.ranked,
      },
      duplicate: result.duplicate,
    });
  });
}
