import * as S from "@hitslop/schema/document";

export default S.Document({
  count: S.Integer({ description: "Current tally count value" }),
});
