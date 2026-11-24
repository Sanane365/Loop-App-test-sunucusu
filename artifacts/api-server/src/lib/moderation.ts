import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export const SPAM_REPORT_THRESHOLD = 30;
export const SPAM_REPORT_WINDOW_DAYS = 7;

export const moderationSchemaReady = (async () => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS moderation_reports (
      id serial PRIMARY KEY,
      reporter_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reported_user_id integer REFERENCES users(id) ON DELETE SET NULL,
      target_type text NOT NULL,
      target_id integer,
      reason text NOT NULL,
      details text,
      status text NOT NULL DEFAULT 'open',
      assigned_to integer REFERENCES users(id) ON DELETE SET NULL,
      resolution text,
      created_at timestamp NOT NULL DEFAULT now(),
      resolved_at timestamp
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS moderation_warnings (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      issued_by integer REFERENCES users(id) ON DELETE SET NULL,
      reason text NOT NULL,
      severity text NOT NULL DEFAULT 'low',
      source text NOT NULL DEFAULT 'admin',
      created_at timestamp NOT NULL DEFAULT now(),
      expires_at timestamp
    )
  `);
  await db.execute(sql`ALTER TABLE moderation_warnings ALTER COLUMN issued_by DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE moderation_warnings ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin'`);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS moderation_reports_target_created_at_idx
    ON moderation_reports (reported_user_id, created_at DESC)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS moderation_warnings_user_created_at_idx
    ON moderation_warnings (user_id, created_at DESC)
  `);
})().catch((error) => {
  console.error("Moderation schema initialization failed:", error);
  throw error;
});

type ReportInput = {
  reporterId: number;
  reportedUserId: number;
  targetType: string;
  targetId: number | null;
  reason: string;
  details: string | null;
};

export async function createModerationReport(input: ReportInput) {
  await moderationSchemaReady;

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(836472, ${input.reportedUserId})`);

    const duplicate = input.reason.trim().toLocaleLowerCase("tr-TR") === "spam"
      ? await tx.execute(sql`
          SELECT id
          FROM moderation_reports
          WHERE reporter_id = ${input.reporterId}
            AND reported_user_id = ${input.reportedUserId}
            AND lower(trim(reason)) = 'spam'
            AND created_at >= now() - (${SPAM_REPORT_WINDOW_DAYS} * interval '1 day')
          ORDER BY created_at DESC
          LIMIT 1
        `)
      : null;

    if (duplicate?.rows[0]) {
      return { id: Number(duplicate.rows[0].id), duplicate: true, warningIssued: false };
    }

    const report = await tx.execute(sql`
      INSERT INTO moderation_reports (reporter_id, reported_user_id, target_type, target_id, reason, details)
      VALUES (
        ${input.reporterId},
        ${input.reportedUserId},
        ${input.targetType},
        ${input.targetId},
        ${input.reason},
        ${input.details}
      )
      RETURNING id
    `);
    const reportId = Number(report.rows[0]?.id);

    if (input.reason.trim().toLocaleLowerCase("tr-TR") !== "spam") {
      return { id: reportId, duplicate: false, warningIssued: false };
    }

    const reportCount = await tx.execute(sql`
      SELECT count(DISTINCT reporter_id)::integer AS count
      FROM moderation_reports
      WHERE reported_user_id = ${input.reportedUserId}
        AND lower(trim(reason)) = 'spam'
        AND status <> 'dismissed'
        AND created_at >= now() - (${SPAM_REPORT_WINDOW_DAYS} * interval '1 day')
    `);
    const distinctReporterCount = Number(reportCount.rows[0]?.count ?? 0);
    if (distinctReporterCount < SPAM_REPORT_THRESHOLD) {
      return { id: reportId, duplicate: false, warningIssued: false };
    }

    const recentWarning = await tx.execute(sql`
      SELECT id
      FROM moderation_warnings
      WHERE user_id = ${input.reportedUserId}
        AND source = 'report_threshold'
        AND created_at >= now() - (${SPAM_REPORT_WINDOW_DAYS} * interval '1 day')
      LIMIT 1
    `);
    if (recentWarning.rows.length) {
      return { id: reportId, duplicate: false, warningIssued: false };
    }

    const reason = `Sistem uyarısı: Son ${SPAM_REPORT_WINDOW_DAYS} günde ${distinctReporterCount} farklı hesap bu hesabı spam nedeniyle bildirdi.`;
    await tx.execute(sql`
      INSERT INTO moderation_warnings (user_id, issued_by, reason, severity, source)
      VALUES (${input.reportedUserId}, NULL, ${reason}, 'medium', 'report_threshold')
    `);
    await tx.execute(sql`
      INSERT INTO notifications (user_id, type, data)
      VALUES (
        ${input.reportedUserId},
        'system_warning',
        ${JSON.stringify({
          title: "Spam bildirimi nedeniyle sistem uyarısı",
          message: `Son ${SPAM_REPORT_WINDOW_DAYS} günde ${distinctReporterCount} farklı hesap hesabını spam nedeniyle bildirdi. Topluluk kurallarına uy; bildirim moderasyon ekibinin incelemesine alındı.`,
          reportCount: distinctReporterCount,
        })}::jsonb
      )
    `);

    return { id: reportId, duplicate: false, warningIssued: true };
  });
}
