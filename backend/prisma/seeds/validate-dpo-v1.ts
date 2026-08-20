import { validateOfficialBundle } from "./official-dpo-data";

try {
  console.log("[DPO official v1 validation]", validateOfficialBundle());
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
