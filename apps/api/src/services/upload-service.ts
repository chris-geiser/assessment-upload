import { detectAssessmentType, getAssessmentConfig, type DetectionResult } from "@assessment/shared";
import type { Session } from "../adapters/auth-provider.js";
import { schoolContext } from "../adapters/auth-provider.js";
import type { StorageAdapter } from "../adapters/storage-adapter.js";
import { uploadKey } from "../adapters/storage-adapter.js";
import {
  findDuplicate,
  insertUploadRecord,
  setStorageKey,
  type DuplicateMatch,
} from "../db/uploads-repo.js";
import { logEvent } from "./event-logger.js";

export const DEDUP_WINDOW_DAYS = 90; // FR-020 (configurable)

export interface CreateUploadInput {
  session: Session;
  file: { filename: string; ext: string; buffer: Buffer; sizeBytes: number };
  meta: {
    rowCount: number;
    columnCount: number;
    headers: string[];
    assessmentWindow: string;
    schoolId: string;
    assessmentTypeOverride?: string;
  };
}

export interface CreateUploadResult {
  uploadId: string;
  detection: DetectionResult;
  duplicate: DuplicateMatch | null;
}

// FR-005: the upload record is created before any processing and persists even if
// the upload is later abandoned. The raw file is stored unmodified (FR-006).
export async function createUpload(
  deps: { storage: StorageAdapter },
  input: CreateUploadInput,
): Promise<CreateUploadResult> {
  const { session, file, meta } = input;
  const school = schoolContext(session, meta.schoolId);
  if (!school) {
    // Route already enforces access; this guards against a stale schoolId.
    throw new Error("School is not in the session scope.");
  }

  const detection = detectAssessmentType(meta.headers);
  // Resolve a concrete type to persist: explicit override, else auto-detected, else
  // the best-ranked candidate as a provisional (the UI prompts on ambiguity).
  const assessmentType =
    (meta.assessmentTypeOverride && getAssessmentConfig(meta.assessmentTypeOverride)?.id) ||
    detection.detected ||
    detection.ranked[0]?.id ||
    "UNKNOWN";

  const uploadId = await insertUploadRecord({
    filename: file.filename,
    fileSizeBytes: file.sizeBytes,
    rowCount: meta.rowCount,
    columnCount: meta.columnCount,
    assessmentType,
    assessmentWindow: meta.assessmentWindow,
    schoolId: school.schoolId,
    schoolName: school.schoolName,
    districtId: school.districtId,
    districtName: school.districtName,
    uploadedByUserId: session.userId,
    uploadedByName: session.name,
    uploadedByRole: session.role,
  });

  const key = uploadKey(uploadId, file.ext);
  await deps.storage.put(key, file.buffer);
  await setStorageKey(uploadId, key);

  await logEvent({
    uploadId,
    eventType: "file_received",
    status: "ok",
    detail: {
      filename: file.filename,
      rowCount: meta.rowCount,
      columnCount: meta.columnCount,
      detected: detection.detected,
      ambiguous: detection.ambiguous,
    },
  });

  // Duplicate detection (FR-020). The replace/cancel decision is US6; here we only
  // surface the match so the client can prompt.
  const duplicate = await findDuplicate({
    assessmentType,
    schoolId: school.schoolId,
    assessmentWindow: meta.assessmentWindow,
    excludeUploadId: uploadId,
    windowDays: DEDUP_WINDOW_DAYS,
  });

  return { uploadId, detection, duplicate };
}
