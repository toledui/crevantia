import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../src/database/prisma.service";
import { ConfigurationStatus } from "../src/generated/prisma/client";
import { AssessmentAdminService } from "../src/modules/assessments/assessment-admin.service";

describe("Assessment draft version deletion", () => {
  it("deletes an unused draft and records its number in the audit log", async () => {
    let deletedVersionId: unknown;
    let auditInput: unknown;
    const tx = {
      assessmentVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: "v2",
          assessmentId: "assessment",
          version: 2,
          versionCode: "DPO_PRO_V2",
          status: ConfigurationStatus.DRAFT,
          publishedAt: null,
          scoringKeyVersions: [
            {
              status: ConfigurationStatus.DRAFT,
              publishedAt: null,
              _count: { attempts: 0, resultRuns: 0 },
            },
          ],
          _count: {
            attempts: 0,
            resultRuns: 0,
            reportMappingVersions: 0,
          },
        }),
        count: jest.fn().mockResolvedValue(2),
        delete: jest.fn((input: unknown) => {
          deletedVersionId = input;
          return Promise.resolve({ id: "v2" });
        }),
      },
      scoringKeyVersion: { deleteMany: jest.fn() },
      auditLog: {
        create: jest.fn((input: unknown) => {
          auditInput = input;
          return Promise.resolve({ id: "audit" });
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(
      new AssessmentAdminService(prisma).deleteDraft("actor", "v2"),
    ).resolves.toMatchObject({ success: true, deletedVersion: 2 });
    expect(deletedVersionId).toEqual({ where: { id: "v2" } });
    expect(auditInput).toMatchObject({
      data: {
        action: "ASSESSMENT_VERSION_DELETED",
        after: { assessmentId: "assessment", version: 2, deleted: true },
      },
    });
  });

  it("rejects deletion when the draft has historical attempts", async () => {
    const tx = {
      assessmentVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: "v2",
          assessmentId: "assessment",
          version: 2,
          versionCode: "DPO_PRO_V2",
          status: ConfigurationStatus.DRAFT,
          publishedAt: null,
          scoringKeyVersions: [],
          _count: {
            attempts: 1,
            resultRuns: 0,
            reportMappingVersions: 0,
          },
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(
      new AssessmentAdminService(prisma).deleteDraft("actor", "v2"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects deletion of the only assessment version", async () => {
    const tx = {
      assessmentVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: "v1",
          assessmentId: "assessment",
          version: 1,
          versionCode: "DPO_PRO_V1",
          status: ConfigurationStatus.DRAFT,
          publishedAt: null,
          scoringKeyVersions: [],
          _count: {
            attempts: 0,
            resultRuns: 0,
            reportMappingVersions: 0,
          },
        }),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(
      new AssessmentAdminService(prisma).deleteDraft("actor", "v1"),
    ).rejects.toThrow("única versión");
  });

  it("does not reuse a version number previously deleted", async () => {
    let createInput: unknown;
    const tx = {
      assessmentVersion: {
        create: jest.fn((input: unknown) => {
          createInput = input;
          return Promise.resolve({ id: "v3", version: 3 });
        }),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      assessment: {
        findUnique: jest.fn().mockResolvedValue({
          id: "assessment",
          code: "DPO_PRO",
          versions: [{ id: "v1", version: 1 }],
        }),
      },
      assessmentVersion: { findFirst: jest.fn().mockResolvedValue(null) },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          { after: { assessmentId: "assessment", version: 2 } },
        ]),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    await new AssessmentAdminService(prisma).cloneVersion(
      "actor",
      "assessment",
      {},
    );
    expect(createInput).toMatchObject({
      data: { version: 3, versionCode: "DPO_PRO_V3" },
    });
  });
});
