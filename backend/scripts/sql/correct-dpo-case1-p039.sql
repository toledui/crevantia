-- Corrección puntual del Caso de Prueba 1.
-- Intento: cmt1m1bzo0001gwi90mueejnv
-- DPO-P039: cambia MORE de DPO-R078 a DPO-R077.
--
-- Se recomienda ejecutar el wrapper validado:
-- npm run correct:dpo:case1:p039 --workspace @crevantia/backend -- --apply

START TRANSACTION;

UPDATE `ForcedChoiceAnswer` AS answer
INNER JOIN `PairQuestion` AS pair_question
  ON pair_question.`id` = answer.`pairQuestionId`
INNER JOIN `Reactive` AS previous_reactive
  ON previous_reactive.`id` = answer.`selectedMoreReactiveId`
INNER JOIN `Reactive` AS corrected_reactive
  ON corrected_reactive.`pairQuestionId` = pair_question.`id`
  AND corrected_reactive.`code` = 'DPO-R077'
SET
  answer.`selectedMoreReactiveId` = corrected_reactive.`id`,
  answer.`version` = answer.`version` + 1,
  answer.`updatedAt` = CURRENT_TIMESTAMP(3)
WHERE answer.`attemptId` = 'cmt1m1bzo0001gwi90mueejnv'
  AND pair_question.`code` = 'DPO-P039'
  AND previous_reactive.`code` = 'DPO-R078';

SELECT ROW_COUNT() AS `correctedRows`;

COMMIT;
