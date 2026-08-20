import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../src/database/prisma.service";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import { OFFICIAL_DPO_IDS } from "./seed-dpo-official-v1";

const ISO_REGION_CODES =
  `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(
    " ",
  );

export function countryOptions() {
  const names = new Intl.DisplayNames(["es-MX"], { type: "region" });
  const mexico = names.of("MX") ?? "México";
  const remaining = ISO_REGION_CODES.filter((code) => code !== "MX")
    .map((code) => names.of(code))
    .filter((name): name is string => Boolean(name))
    .sort((left, right) => left.localeCompare(right, "es-MX"));
  return [mexico, ...remaining, "Otro país o territorio"];
}

export async function preloadCountryOptions(prisma: PrismaClient) {
  const field = await prisma.demographicField.findFirst({
    where: {
      assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
      code: "DPO-CTRL-05",
    },
  });
  if (!field) throw new Error("DPO_COUNTRY_FIELD_NOT_FOUND");
  const config =
    field.config &&
    typeof field.config === "object" &&
    !Array.isArray(field.config)
      ? field.config
      : {};
  const options = countryOptions();
  const currentOptions = Array.isArray(config.options) ? config.options : [];
  if (JSON.stringify(currentOptions) === JSON.stringify(options))
    return {
      updated: false,
      optionCount: options.length,
      fieldCode: field.code,
    };

  await prisma.$transaction(async (tx) => {
    await tx.demographicField.update({
      where: { id: field.id },
      data: {
        config: JSON.parse(
          JSON.stringify({ ...config, options }),
        ) as Prisma.InputJsonValue,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "DEMOGRAPHIC_COUNTRY_CATALOG_PRELOADED",
        entityType: "DemographicField",
        entityId: field.id,
        before: { options: currentOptions },
        after: { optionCount: options.length },
        reason:
          "Precarga operativa del catálogo de países en la versión actual; no se creó una versión de evaluación.",
      },
    });
  });
  return { updated: true, optionCount: options.length, fieldCode: field.code };
}

async function main() {
  const prisma = new PrismaService(
    new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }),
  );
  await prisma.onModuleInit();
  try {
    const result = await preloadCountryOptions(prisma);
    console.log(
      `Catálogo ${result.updated ? "actualizado" : "ya vigente"}: ${result.optionCount} opciones en ${result.fieldCode}; versión conservada ${OFFICIAL_DPO_IDS.assessmentVersion}.`,
    );
  } finally {
    await prisma.onModuleDestroy();
  }
}

if (require.main === module) {
  void main();
}
