/// Synthesizes the memberwise initializer and `SlopJSONCodable` implementation
/// used by host-owned JSON documents and typed SQLite query results.
@attached(member, names: named(init), named(json))
@attached(extension, conformances: SlopJSONCodable)
public macro SlopModel() = #externalMacro(module: "SlopMacros", type: "SlopModelMacro")

/// Builds a parameterized SQL statement. Every interpolation becomes a `?`
/// binding and cannot alter the SQL statement's structure.
@freestanding(expression)
public macro sql(_ statement: String) -> SlopStatement =
    #externalMacro(module: "SlopMacros", type: "SlopSQLMacro")
