-- Reactive codes identify content inside an assessment version. Reusing the
-- same stable code in a cloned version is required for immutable versioning.
DROP INDEX `Reactive_code_key` ON `Reactive`;
CREATE INDEX `Reactive_code_idx` ON `Reactive`(`code`);
