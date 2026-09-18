import * as S from "@hitslop/schema/document";
export default S.Document({ title: S.String({ maxLength: 30 }), count: S.Integer() });
export const initial = { title: "Before", count: 0 };
