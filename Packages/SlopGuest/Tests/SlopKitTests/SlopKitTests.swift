import SlopKit
import Testing

@SlopModel
private struct Item: Equatable {
    var id: Int
    var title: String
    var done: Bool
    var note: String?
}

@SlopModel
private struct Document: Equatable {
    var title: String
    var items: [Item]
    var metadata: [String: String]
}

@Test
func modelRoundTripsNestedValues() {
    let document = Document(
        title: "Inbox",
        items: [Item(id: 1, title: "Ship", done: false, note: nil)],
        metadata: ["owner": "Jordan"]
    )
    #expect(Document(json: document.json) == document)
}

@Test
func modelIgnoresUnknownKeysAndRejectsInvalidArrayElements() {
    let valid: SlopJSONValue = .object([
        "id": .number(1),
        "title": .string("Ship"),
        "done": .number(1),
        "note": .null,
        "future": .string("ignored"),
    ])
    #expect(Item(json: valid) == Item(id: 1, title: "Ship", done: true, note: nil))

    let invalid: SlopJSONValue = .object([
        "title": .string("Inbox"),
        "items": .array([valid, .string("not an item")]),
        "metadata": .object([:]),
    ])
    #expect(Document(json: invalid) == nil)
}

@Test
func modelTreatsMissingOptionalAsNilAndRequiresNonoptionalFields() {
    let missingOptional: SlopJSONValue = .object([
        "id": .number(1),
        "title": .string("Ship"),
        "done": .bool(false),
    ])
    #expect(Item(json: missingOptional) == Item(id: 1, title: "Ship", done: false, note: nil))

    let missingRequired: SlopJSONValue = .object([
        "id": .number(1),
        "done": .bool(false),
    ])
    #expect(Item(json: missingRequired) == nil)
}

@Test
func modelRejectsLossyAndOutOfRangeIntegers() {
    let fractional: SlopJSONValue = .object([
        "id": .number(1.5),
        "title": .string("Ship"),
        "done": .bool(false),
        "note": .null,
    ])
    #expect(Item(json: fractional) == nil)

    let infinite: SlopJSONValue = .object([
        "id": .number(.infinity),
        "title": .string("Ship"),
        "done": .bool(false),
        "note": .null,
    ])
    #expect(Item(json: infinite) == nil)
}

@Test
func sqlMacroUsesBindingsForInterpolations() {
    let title = "Robert'); DROP TABLE todos;--"
    let id = 42
    let statement = #sql("UPDATE todos SET title = \(title) WHERE id = \(id)")
    #expect(statement.sql == "UPDATE todos SET title = ? WHERE id = ?")
    #expect(statement.parameters == [.string(title), .number(42)])
}
