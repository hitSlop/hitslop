import * as S from "@hitslop/schema/document";

const counterSchema = S.Document({
  count: S.Integer({ description: "Current tally count value" }),
});

export default counterSchema;
