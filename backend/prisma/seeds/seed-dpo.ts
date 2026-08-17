import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../src/generated/prisma/client";
import { seedAssessment } from "./seed-assessment";
import { seedDpoPermissions } from "./seed-dpo-permissions";
import { seedNorm } from "./seed-norm";
import { seedQuestionBank } from "./seed-question-bank";
import { seedScoringKey } from "./seed-scoring-key";

export async function seedDpo(prisma: PrismaClient) {
  await seedDpoPermissions(prisma);
  await seedAssessment(prisma);
  await seedQuestionBank(prisma);
  await seedScoringKey(prisma);
  await seedNorm(prisma);
  const counts = {
    assessmentVersions: await prisma.assessmentVersion.count({
      where: { assessmentId: "assessment-dpo-pro" },
    }),
    sections: await prisma.assessmentSection.count({
      where: { assessmentVersionId: "assessment-version-dpo-pro-v1" },
    }),
    pairQuestions: await prisma.pairQuestion.count({
      where: { assessmentVersionId: "assessment-version-dpo-pro-v1" },
    }),
    reactives: await prisma.reactive.count({
      where: {
        pairQuestion: { assessmentVersionId: "assessment-version-dpo-pro-v1" },
      },
    }),
    likertQuestions: await prisma.likertQuestion.count({
      where: { assessmentVersionId: "assessment-version-dpo-pro-v1" },
    }),
    scales: await prisma.scale.count(),
    composites: await prisma.composite.count(),
    scoringRules: await prisma.reactiveScoringRule.count({
      where: { scoringKeyVersionId: "scoring-key-version-dpo-express-v6-1" },
    }),
    normTargets: await prisma.normTarget.count({
      where: { normVersionId: "norm-version-global-412-v1" },
    }),
    thresholds: await prisma.normThreshold.count({
      where: { normTarget: { normVersionId: "norm-version-global-412-v1" } },
    }),
  };
  console.log("[DPO seed report]", counts);
  return counts;
}

function adapter() {
  const url = new URL(
    process.env.DATABASE_URL ?? "mysql://root:@127.0.0.1:3306/crevantia",
  );
  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 5,
  });
}

if (require.main === module) {
  const prisma = new PrismaClient({ adapter: adapter() });
  seedDpo(prisma)
    .finally(async () => prisma.$disconnect())
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
