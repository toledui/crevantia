import { BadRequestException } from "@nestjs/common";
import {
  ConfigurationStatus,
  NormTargetType,
} from "../src/generated/prisma/client";
import type { PrismaService } from "../src/database/prisma.service";
import { NormsService } from "../src/modules/norms/norms.service";
import { validateNormTargets } from "../src/modules/norms/norm-validator";

describe("Norm lifecycle", () => {
  it("activates a published norm and reassigns unfinished attempts", async () => {
    let attemptUpdate: unknown;
    let activationUpdate: unknown;
    const version = {
      id: "norm-v2",
      normSetId: "set",
      status: ConfigurationStatus.APPROVED,
      configurationHash: "b".repeat(64),
    };
    const tx = {
      normVersion: { updateMany: jest.fn(), update: jest.fn() },
      attempt: {
        updateMany: jest.fn((input: unknown) => {
          attemptUpdate = input;
          return Promise.resolve({ count: 2 });
        }),
      },
      assessmentActiveConfiguration: {
        updateMany: jest.fn((input: unknown) => {
          activationUpdate = input;
          return Promise.resolve({ count: 1 });
        }),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      normVersion: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(version)
          .mockResolvedValueOnce({
            ...version,
            status: ConfigurationStatus.PUBLISHED,
            targets: [],
            validationRuns: [],
            normSet: {},
          }),
      },
      normValidationRun: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "validation", hasErrors: false }),
      },
      assessmentActiveConfiguration: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              id: "active",
              assessmentId: "assessment",
              normVersionId: "norm-v1",
            },
          ]),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    const published = await new NormsService(prisma).publish(
      "actor",
      "norm-v2",
    );

    expect(attemptUpdate).toMatchObject({
      data: { normVersionId: "norm-v2" },
    });
    expect(activationUpdate).toMatchObject({
      data: { normVersionId: "norm-v2" },
    });
    expect(published.activation).toEqual({
      activatedAssessments: 1,
      reassignedAttempts: 2,
    });
  });

  it("rejects threshold updates on a published version", async () => {
    const prisma = {
      normTarget: {
        findUnique: jest.fn().mockResolvedValue({
          id: "target",
          normVersionId: "v1",
          normVersion: { status: ConfigurationStatus.PUBLISHED },
          thresholds: [],
        }),
      },
    } as unknown as PrismaService;
    const service = new NormsService(prisma);
    await expect(
      service.replaceThresholds("actor", "target", {
        thresholds: [{ decile: 1, ordinal: 1, lowerBound: 0 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows a draft threshold replacement without mutating another version", async () => {
    const tx = {
      normThreshold: { deleteMany: jest.fn(), createMany: jest.fn() },
      normVersion: { update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const detail = {
      id: "v2",
      normSetId: "set",
      status: ConfigurationStatus.DRAFT,
      targets: [],
      validationRuns: [],
      normSet: {},
    };
    const prisma = {
      normTarget: {
        findUnique: jest.fn().mockResolvedValue({
          id: "target",
          normVersionId: "v2",
          normVersion: { status: ConfigurationStatus.DRAFT },
          thresholds: [{ decile: 1, ordinal: 1, lowerBound: 0 }],
        }),
      },
      normVersion: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          version: 2,
          lookupMethod: "LAST_LOWER_BOUND_LTE",
          numericMode: "EXCEL_BINARY64",
          roundingMode: "NONE_BEFORE_NORM_LOOKUP",
          targets: [],
        }),
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(detail),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new NormsService(prisma);
    await expect(
      service.replaceThresholds("actor", "target", {
        thresholds: [{ decile: 1, ordinal: 1, lowerBound: 0 }],
      }),
    ).resolves.toMatchObject({ id: "v2" });
    expect(tx.normThreshold.deleteMany).toHaveBeenCalledWith({
      where: { normTargetId: "target" },
    });
  });

  it("rejects a technical identity correction when the norm has historical results", async () => {
    const prisma = {
      normTarget: {
        findUnique: jest.fn().mockResolvedValue({
          id: "target",
          normVersionId: "v2",
          targetType: NormTargetType.SCALE,
          targetCode: "DPO-S001",
          normVersion: { status: ConfigurationStatus.DRAFT },
          thresholds: [],
        }),
      },
      resultRun: { count: jest.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;
    const service = new NormsService(prisma);

    await expect(
      service.updateTarget("actor", "target", {
        targetType: NormTargetType.SCALE,
        targetCode: "DPO-S002",
        name: "Adaptación",
        status: "REVIEW_REQUIRED",
        isBlocked: false,
      }),
    ).rejects.toThrow("resultados históricos");
  });

  it("corrects a draft target identity, rehashes it and records a specific audit action", async () => {
    const current = {
      id: "target",
      normVersionId: "v2",
      targetType: NormTargetType.SCALE,
      targetCode: "DPO-S099",
      name: "Adaptación",
      status: "REVIEW_REQUIRED",
      isBlocked: false,
      validationNotes: null,
      normVersion: { status: ConfigurationStatus.DRAFT },
      thresholds: [],
    };
    const updated = {
      ...current,
      targetCode: "DPO-S001",
      normVersion: undefined,
      thresholds: undefined,
    };
    let capturedUpdate: unknown;
    const updateTarget = jest.fn((input: unknown) => {
      capturedUpdate = input;
      return Promise.resolve(updated);
    });
    let capturedAudit: unknown;
    const createAudit = jest.fn((input: unknown) => {
      capturedAudit = input;
    });
    const prisma = {
      normTarget: {
        findUnique: jest.fn().mockResolvedValue(current),
        findFirst: jest.fn().mockResolvedValue(null),
        update: updateTarget,
      },
      resultRun: { count: jest.fn().mockResolvedValue(0) },
      scale: { findUnique: jest.fn().mockResolvedValue({ id: "scale" }) },
      normVersion: {
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          version: 2,
          lookupMethod: "LAST_LOWER_BOUND_LTE",
          numericMode: "EXCEL_BINARY64",
          roundingMode: "NONE_BEFORE_NORM_LOOKUP",
          targets: [
            {
              targetType: NormTargetType.SCALE,
              targetCode: "DPO-S001",
              isBlocked: false,
              thresholds: [],
            },
          ],
        }),
      },
      auditLog: { create: createAudit },
    } as unknown as PrismaService;
    const service = new NormsService(prisma);

    await expect(
      service.updateTarget("actor", "target", {
        targetType: NormTargetType.SCALE,
        targetCode: " DPO-S001 ",
        name: "Adaptación",
        status: "REVIEW_REQUIRED",
        isBlocked: false,
      }),
    ).resolves.toMatchObject({ targetCode: "DPO-S001" });
    const updateInput = capturedUpdate as {
      data: { targetType: NormTargetType; targetCode: string };
    };
    expect(updateInput.data).toMatchObject({
      targetType: NormTargetType.SCALE,
      targetCode: "DPO-S001",
    });
    const auditInput = capturedAudit as {
      data: { action: string };
    };
    expect(auditInput.data.action).toBe("NORM_TARGET_IDENTITY_CORRECTED");
  });

  it("clones targets and thresholds into the next draft version", async () => {
    const source = {
      id: "v1",
      normSetId: "set",
      version: 1,
      name: "Global",
      description: null,
      status: ConfigurationStatus.PUBLISHED,
      populationLabel: "Global",
      sampleSize: 412,
      country: null,
      ageRange: null,
      notes: null,
      lookupMethod: "LAST_LOWER_BOUND_LTE",
      numericMode: "EXCEL_BINARY64",
      roundingMode: "NONE_BEFORE_NORM_LOOKUP",
      configurationHash: "a".repeat(64),
      targets: [
        {
          targetType: NormTargetType.SCALE,
          targetCode: "DPO-S001",
          sourceCode: "adaptacion",
          name: "Adaptación",
          status: "VALIDATED_STRUCTURE",
          isBlocked: false,
          validationNotes: null,
          sourceReference: "V3:W12",
          thresholds: [
            { decile: 1, ordinal: 1, lowerBound: 0, sourceMetadata: null },
          ],
        },
      ],
      validationRuns: [],
      normSet: {},
    };
    const created = { id: "v2", version: 2, status: ConfigurationStatus.DRAFT };
    let createInput: unknown;
    const tx = {
      normVersion: {
        create: jest.fn((input: unknown) => {
          createInput = input;
          return Promise.resolve(created);
        }),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      normVersion: {
        findUnique: jest.fn().mockResolvedValue(source),
        aggregate: jest.fn().mockResolvedValue({ _max: { version: 1 } }),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new NormsService(prisma);
    await expect(service.clone("actor", "set", "v1")).resolves.toEqual(created);
    const create = createInput as {
      data: {
        version: number;
        status: ConfigurationStatus;
        targets: { create: unknown[] };
      };
    };
    expect(create.data.version).toBe(2);
    expect(create.data.status).toBe(ConfigurationStatus.DRAFT);
    expect(create.data.targets.create).toHaveLength(1);
  });

  it("reports blocked targets and duplicate cut points without changing them", () => {
    const issues = validateNormTargets([
      {
        targetType: "SCALE",
        targetCode: "DPO-S001",
        isBlocked: true,
        thresholds: Array.from({ length: 10 }, (_, index) => ({
          decile: index + 1,
          ordinal: index + 1,
          lowerBound: index < 2 ? 0 : index,
        })),
      },
    ]);
    expect(issues.some(({ code }) => code === "TARGET_BLOCKED")).toBe(true);
    expect(issues.some(({ code }) => code === "DUPLICATE_LOWER_BOUND")).toBe(
      true,
    );
  });
});
