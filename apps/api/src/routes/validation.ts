import type { FastifyInstance } from "fastify";
import {
  getAssessmentConfig,
  unmappedRequiredFields,
  validateRows,
  type ColumnMapping,
  type SourceRow,
} from "@assessment/shared";
import { assertSchoolAccess, requireRoles } from "../plugins/auth.js";
import { getUpload } from "../db/uploads-repo.js";

interface ValidateBody {
  rows?: SourceRow[];
  columnMapping?: ColumnMapping;
}

// POST /api/uploads/:uploadId/validate — server-side validation with the full shared
// engine (P8). Same engine + config as the client, so results agree on every fixture.
export async function validationRoutes(app: FastifyInstance): Promise<void> {
  const guard = requireRoles("SCHOOL_ADMIN", "DISTRICT_ADMIN", "IGNITE_ADMIN");

  app.post<{ Params: { uploadId: string }; Body: ValidateBody }>(
    "/uploads/:uploadId/validate",
    { preHandler: guard },
    async (req, reply) => {
      const upload = await getUpload(req.params.uploadId);
      if (!upload) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "That upload was not found." } });
      }
      if (!assertSchoolAccess(req, reply, upload.school_id)) return reply;

      const config = getAssessmentConfig(upload.assessment_type);
      if (!config) {
        return reply.code(400).send({
          error: { code: "UNKNOWN_TYPE", message: "The assessment type for this upload is not configured." },
        });
      }

      const mapping = req.body.columnMapping ?? {};
      const rows = req.body.rows ?? [];

      const missingFields = unmappedRequiredFields(config, mapping);
      if (missingFields.length > 0) {
        return reply.code(422).send({
          error: {
            code: "REQUIRED_FIELDS_UNMAPPED",
            message: `Map these required fields before validating: ${missingFields
              .map((f) => config.canonicalFields.find((c) => c.name === f)?.label ?? f)
              .join(", ")}.`,
          },
          missingFields,
        });
      }

      const result = validateRows(rows, mapping, config);
      return reply.code(200).send(result);
    },
  );
}
