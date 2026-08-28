import Foundation
import SwiftCompilerPlugin
import SwiftSyntax
import SwiftSyntaxBuilder
import SwiftSyntaxMacros

@main
struct SlopMacrosPlugin: CompilerPlugin {
    let providingMacros: [Macro.Type] = [
        SlopModelMacro.self,
        SlopSQLMacro.self,
    ]
}

private struct ModelProperty {
    let identifier: TokenSyntax
    let type: TypeSyntax
    let initializer: ExprSyntax?

    var sourceName: String { identifier.text }
    var key: String { identifier.text.trimmingCharacters(in: CharacterSet(charactersIn: "`")) }
}

public enum SlopModelMacro: MemberMacro, ExtensionMacro {
    public static func expansion(
        of node: AttributeSyntax,
        providingMembersOf declaration: some DeclGroupSyntax,
        conformingTo protocols: [TypeSyntax],
        in context: some MacroExpansionContext
    ) throws -> [DeclSyntax] {
        guard declaration.is(StructDeclSyntax.self) else {
            throw MacroExpansionErrorMessage("@SlopModel can only be applied to a struct")
        }

        let properties = try collectProperties(from: declaration)
        guard !properties.isEmpty else { return [] }
        let access = accessPrefix(for: declaration)
        var declarations: [DeclSyntax] = []

        let hasInitializer = declaration.memberBlock.members.contains { member in
            member.decl.is(InitializerDeclSyntax.self)
        }
        if !hasInitializer {
            let parameters = properties.map { property in
                let defaultValue = property.initializer.map { " = \($0.trimmedDescription)" } ?? ""
                return "\(property.sourceName): \(property.type.trimmedDescription)\(defaultValue)"
            }.joined(separator: ", ")
            let assignments = properties.map { "self.\($0.sourceName) = \($0.sourceName)" }
                .joined(separator: "\n")
            declarations.append(DeclSyntax(stringLiteral: """
            \(access)init(\(parameters)) {
                \(assignments)
            }
            """))
        }

        let decodings = properties.map { property in
            "let \(property.sourceName) = SlopValueCoding.decode(object[\"\(property.key)\"], as: \(property.type.trimmedDescription).self)"
        }.joined(separator: ",\n")
        let assignments = properties.map { "self.\($0.sourceName) = \($0.sourceName)" }
            .joined(separator: "\n")
        declarations.append(DeclSyntax(stringLiteral: """
        \(access)init?(json: SlopJSONValue) {
            guard let object = json.objectValue,
                  \(decodings)
            else { return nil }
            \(assignments)
        }
        """))

        let encodings = properties.map { property in
            "\"\(property.key)\": SlopValueCoding.encode(\(property.sourceName))"
        }.joined(separator: ",\n")
        declarations.append(DeclSyntax(stringLiteral: """
        \(access)var json: SlopJSONValue {
            .object([
                \(encodings)
            ])
        }
        """))

        return declarations
    }

    public static func expansion(
        of node: AttributeSyntax,
        attachedTo declaration: some DeclGroupSyntax,
        providingExtensionsOf type: some TypeSyntaxProtocol,
        conformingTo protocols: [TypeSyntax],
        in context: some MacroExpansionContext
    ) throws -> [ExtensionDeclSyntax] {
        guard declaration.is(StructDeclSyntax.self) else { return [] }
        return [try ExtensionDeclSyntax("extension \(type): SlopJSONCodable {}")]
    }

    private static func collectProperties(
        from declaration: some DeclGroupSyntax
    ) throws -> [ModelProperty] {
        var result: [ModelProperty] = []
        for member in declaration.memberBlock.members {
            guard let variable = member.decl.as(VariableDeclSyntax.self) else { continue }
            if variable.modifiers.contains(where: { modifier in
                modifier.name.tokenKind == .keyword(.static) || modifier.name.tokenKind == .keyword(.class)
            }) {
                continue
            }
            guard variable.bindings.count == 1,
                  let binding = variable.bindings.first,
                  binding.accessorBlock == nil,
                  let identifier = binding.pattern.as(IdentifierPatternSyntax.self)?.identifier
            else {
                throw MacroExpansionErrorMessage("@SlopModel properties must be simple stored properties")
            }
            guard let type = binding.typeAnnotation?.type else {
                throw MacroExpansionErrorMessage("@SlopModel properties require an explicit type annotation")
            }
            result.append(ModelProperty(
                identifier: identifier,
                type: type,
                initializer: binding.initializer?.value
            ))
        }
        return result
    }

    private static func accessPrefix(for declaration: some DeclGroupSyntax) -> String {
        if declaration.modifiers.contains(where: { $0.name.tokenKind == .keyword(.public) }) {
            return "public "
        }
        if declaration.modifiers.contains(where: { $0.name.tokenKind == .keyword(.package) }) {
            return "package "
        }
        return ""
    }
}

public enum SlopSQLMacro: ExpressionMacro {
    public static func expansion(
        of node: some FreestandingMacroExpansionSyntax,
        in context: some MacroExpansionContext
    ) throws -> ExprSyntax {
        guard node.arguments.count == 1,
              let argument = node.arguments.first?.expression,
              let literal = argument.as(StringLiteralExprSyntax.self)
        else {
            throw MacroExpansionErrorMessage("#sql requires one string literal")
        }

        var sql = ""
        var parameters: [ExprSyntax] = []
        for segment in literal.segments {
            if let text = segment.as(StringSegmentSyntax.self) {
                sql += text.content.text
                continue
            }
            guard let expressionSegment = segment.as(ExpressionSegmentSyntax.self),
                  expressionSegment.expressions.count == 1,
                  let interpolation = expressionSegment.expressions.first,
                  interpolation.label == nil
            else {
                throw MacroExpansionErrorMessage(
                    "SQL interpolations must contain one unlabeled value expression"
                )
            }
            sql += "?"
            parameters.append(interpolation.expression)
        }

        let sqlLiteral = StringLiteralExprSyntax(content: sql)
        let encodedParameters = parameters
            .map { "SlopValueCoding.encode(\($0.trimmedDescription))" }
            .joined(separator: ", ")
        return ExprSyntax(stringLiteral: "SlopStatement(sql: \(sqlLiteral.trimmedDescription), parameters: [\(encodedParameters)])")
    }
}
