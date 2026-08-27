import Foundation
import justhtml

public struct SlopActionPlan: Equatable, Sendable {
    public let name: String
    public let sql: String
    public let params: [String]
}

enum SlopRegionCardinality: Equatable {
    case exactlyOne
    case zeroOrMore

    var elementName: String {
        switch self {
        case .exactlyOne: "slop-row"
        case .zeroOrMore: "slop-each"
        }
    }
}

struct SlopRegionPlan {
    let index: Int
    let cardinality: SlopRegionCardinality
    let alias: String
    let sql: String
    let template: Node
    let columns: Set<String>
}

struct SlopCompiledView {
    let source: String
    let skeleton: String
    let regions: [SlopRegionPlan]
    let actions: [String: SlopActionPlan]
}

public final class SlopCheckedRenderer {
    public static let markerName = "hitslop-renderer"
    public static let markerValue = "sql-html-v1"

    private let database: SlopDatabase
    private var compiled: SlopCompiledView?

    public init(database: SlopDatabase) {
        self.database = database
    }

    public static func isChecked(_ html: String) -> Bool {
        html.contains("hitslop-renderer") && html.contains(markerValue)
    }

    public static func displayHTML(from database: SlopDatabase) throws -> String {
        let html = try database.mainHTML()
        guard isChecked(html) else { return html }
        return try SlopCheckedRenderer(database: database).render(source: html)
    }

    public static func validateIfNeeded(database: SlopDatabase) throws {
        let html = try database.mainHTML()
        guard isChecked(html) else { return }
        _ = try SlopCheckedRenderer(database: database).compile(source: html)
    }

    public var cachedSource: String? { compiled?.source }

    public func isChecked() throws -> Bool {
        try Self.isChecked(database.mainHTML())
    }

    @discardableResult
    func compile(source: String? = nil) throws -> SlopCompiledView {
        let source = try source ?? database.mainHTML()
        if let compiled, compiled.source == source { return compiled }

        let document = try SlopHTML.parseDocument(source)
        let marker = try SlopHTML.query(document, "meta[name='\(Self.markerName)']").first
        guard marker?.attrs["content"] == Self.markerValue else {
            throw SlopError.invalidArgument(
                "view HTML needs <meta name=\"\(Self.markerName)\" content=\"\(Self.markerValue)\">"
            )
        }
        guard SlopHTML.htmlElement(in: document) != nil,
              try SlopHTML.query(document, "body").first != nil else {
            throw SlopError.invalidArgument("view HTML must be a complete HTML document")
        }

        try rejectBrowserCode(document, allowSQLScripts: true)

        var actions: [String: SlopActionPlan] = [:]
        for script in try SlopHTML.query(document, "script[data-slop-action]") {
            let name = script.attrs["data-slop-action"] ?? ""
            try validateActionName(name)
            if actions[name] != nil {
                throw SlopError.invalidArgument("Duplicate action: \(name)")
            }
            guard script.attrs["type"] == "application/sql" else {
                throw SlopError.invalidArgument("Action \(name) must use type=application/sql")
            }
            let shape = try inspectSlopSQL(SlopHTML.textContent(script))
            try database.validateActionSQL(shape.sql)
            actions[name] = SlopActionPlan(name: name, sql: shape.sql, params: shape.params)
            script.parent?.removeChild(script)
        }

        if try !SlopHTML.query(document, "slop-query").isEmpty {
            throw SlopError.invalidArgument("slop-query is obsolete; use slop-row or slop-each with an as alias")
        }

        let regionElements = try SlopHTML.queryVisible(document, "slop-row").map { ($0, SlopRegionCardinality.exactlyOne) }
            + SlopHTML.queryVisible(document, "slop-each").map { ($0, SlopRegionCardinality.zeroOrMore) }
        var regions: [SlopRegionPlan] = []
        for (index, entry) in regionElements.enumerated() {
            regions.append(try compileRegion(entry.0, cardinality: entry.1, index: index))
        }

        try rejectBrowserCode(document, allowSQLScripts: false)
        if let reference = try placeholders(in: document).first {
            throw SlopError.invalidArgument(
                "Placeholder {{\(reference.alias).\(reference.column)}} must be inside a slop-row or slop-each template"
            )
        }
        for base in try SlopHTML.query(document, "base") {
            base.parent?.removeChild(base)
        }

        let compiled = SlopCompiledView(
            source: source,
            skeleton: SlopHTML.serialize(document),
            regions: regions,
            actions: actions
        )
        self.compiled = compiled
        return compiled
    }

    public func action(named name: String) throws -> SlopActionPlan? {
        try compile().actions[name]
    }

    public func render(source: String? = nil) throws -> String {
        let plan = try compile(source: source)
        return try database.withReadSnapshot {
            let document = try SlopHTML.parseDocument(plan.skeleton)
            for region in plan.regions {
                let elementName = region.cardinality.elementName
                guard let destination = try SlopHTML.query(
                    document,
                    "\(elementName)[data-slop-region-index='\(region.index)']"
                ).first else {
                    throw SlopError.invalidArgument("Missing compiled \(elementName) region \(region.index)")
                }
                let rows = try database.renderQuery(region.sql)
                if region.cardinality == .exactlyOne, rows.count != 1 {
                    throw SlopError.invalidArgument(
                        "slop-row \(region.index) alias \(region.alias) expected exactly one row; query returned \(rows.count)"
                    )
                }
                for row in rows {
                    let fragment = region.template.cloneNode(deep: true)
                    try substitute(fragment, alias: region.alias, row: row)
                    SlopHTML.insertMoving(fragment, before: destination)
                }
                destination.parent?.removeChild(destination)
            }

            for form in try SlopHTML.query(document, "form[data-slop-action]") {
                let name = form.attrs["data-slop-action"] ?? ""
                guard let action = plan.actions[name] else {
                    throw SlopError.invalidArgument("Form references unknown action: \(name)")
                }
                let controls = try namedControls(in: form)
                let names = Set(controls)
                let expected = Set(action.params)
                if names != expected {
                    let wanted = action.params.joined(separator: ", ")
                    throw SlopError.invalidArgument("Form fields for \(name) must exactly match: \(wanted)")
                }
                form.attrs["method"] = "post"
            }

            return SlopHTML.serialize(document)
        }
    }

    public func performAction(name: String, params: [String: String]) throws -> String {
        guard let action = try compile().actions[name] else {
            throw SlopError.invalidArgument("Unknown action: \(name)")
        }
        let expected = Set(action.params)
        let got = Set(params.keys)
        if expected != got {
            let wanted = action.params.joined(separator: ", ")
            throw SlopError.invalidArgument("Action \(name) fields must exactly match: \(wanted)")
        }
        _ = try database.executeNamed(action.sql, fields: params)
        return try render()
    }

    private func uniqueColumns(_ names: [String]) throws -> Set<String> {
        let unique = Set(names)
        if unique.count != names.count {
            throw SlopError.invalidArgument("Query result column names must be unique")
        }
        return unique
    }

    private func validateActionName(_ name: String) throws {
        let pattern = /^[a-z][a-z0-9-]*$/
        guard name.wholeMatch(of: pattern) != nil else {
            throw SlopError.invalidArgument("Invalid action name: \(name)")
        }
    }

    private func compileRegion(
        _ element: Node,
        cardinality: SlopRegionCardinality,
        index: Int
    ) throws -> SlopRegionPlan {
        let elementName = cardinality.elementName
        if try SlopHTML.closest(element.parent, "slop-row") != nil ||
            SlopHTML.closest(element.parent, "slop-each") != nil {
            throw SlopError.invalidArgument("slop-row and slop-each regions cannot be nested")
        }
        let alias = element.attrs["as"] ?? ""
        try validateAlias(alias, region: elementName, index: index)
        let scripts = SlopHTML.directChildren(element, named: "script").filter { $0.attrs["type"] == "application/sql" }
        let templates = SlopHTML.directChildren(element, named: "template")
        guard scripts.count == 1, templates.count == 1 else {
            throw SlopError.invalidArgument(
                "Each \(elementName) needs exactly one direct SQL script and one template"
            )
        }
        let shape = try inspectSlopSQL(SlopHTML.textContent(scripts[0]))
        if !shape.params.isEmpty {
            throw SlopError.invalidArgument("Render queries cannot accept parameters")
        }
        let columns = try uniqueColumns(database.prepareRender(shape.sql).columns)
        guard let templateContent = templates[0].templateContent else {
            throw SlopError.invalidArgument("\(elementName) template \(index) is empty")
        }
        let template = templateContent.cloneNode(deep: true)
        if try !SlopHTML.queryVisible(template, "slop-row").isEmpty ||
            !SlopHTML.queryVisible(template, "slop-each").isEmpty {
            throw SlopError.invalidArgument("slop-row and slop-each regions cannot be nested")
        }
        try rejectBrowserCode(template, allowSQLScripts: false)
        for reference in try placeholders(in: template) {
            guard reference.alias == alias else {
                throw SlopError.invalidArgument(
                    "\(elementName) \(index) uses alias \(reference.alias); expected \(alias)"
                )
            }
            guard columns.contains(reference.column) else {
                throw SlopError.invalidArgument(
                    "\(elementName) \(index) alias \(alias) has no query column \(reference.column)"
                )
            }
        }
        element.attrs["data-slop-region-index"] = String(index)
        SlopHTML.removeAllChildren(element)
        return SlopRegionPlan(
            index: index,
            cardinality: cardinality,
            alias: alias,
            sql: shape.sql,
            template: template,
            columns: columns
        )
    }

    private func validateAlias(_ alias: String, region: String, index: Int) throws {
        let pattern = /^[A-Za-z_][A-Za-z0-9_]*$/
        guard alias.wholeMatch(of: pattern) != nil else {
            throw SlopError.invalidArgument("\(region) \(index) has invalid or missing as alias: \(alias)")
        }
    }

    private func namedControls(in form: Node) throws -> [String] {
        var names: [String] = []
        SlopHTML.walk(form, visitTemplateContent: false) { node in
            guard ["input", "textarea", "select"].contains(node.name),
                  let name = node.attrs["name"], !name.isEmpty else { return }
            names.append(name)
        }
        if Set(names).count != names.count {
            throw SlopError.invalidArgument("Control names must be unique within a form")
        }
        return names
    }

    private func placeholders(in root: Node) throws -> Set<PlaceholderReference> {
        var found = Set<PlaceholderReference>()
        try SlopHTML.walk(root) { node in
            if node.name == "#text" {
                found.formUnion(try placeholderReferences(in: node.text))
            }
            if node.name.first?.isLetter == true || node.name.contains("-") {
                for value in node.attrs.values {
                    found.formUnion(try placeholderReferences(in: value))
                }
            }
        }
        return found
    }

    private func substitute(_ root: Node, alias: String, row: [String: Any]) throws {
        try SlopHTML.walk(root) { node in
            if node.name == "#text" {
                SlopHTML.setText(node, try interpolate(node.text, alias: alias, row: row))
            }
            if node.name.first?.isLetter == true || node.name.contains("-") {
                let attrs = node.attrs
                for (name, value) in attrs {
                    node.attrs[name] = try interpolate(value, alias: alias, row: row)
                }
            }
        }
    }

    private func interpolate(_ value: String, alias: String, row: [String: Any]) throws -> String {
        try replacingPlaceholders(in: value) { reference in
            guard reference.alias == alias else {
                throw SlopError.invalidArgument("Template uses alias \(reference.alias); expected \(alias)")
            }
            return try renderValue(row[reference.column], column: reference.column)
        }
    }

    private func renderValue(_ raw: Any?, column: String) throws -> String {
        switch raw {
        case nil, is NSNull:
            return ""
        case is Data:
            throw SlopError.invalidArgument("BLOB column \(column) cannot be rendered into HTML")
        case let value as String:
            return value
        case let value as Int64:
            return String(value)
        case let value as Int:
            return String(value)
        case let value as Double:
            return String(value)
        default:
            return String(describing: raw!)
        }
    }

    private func rejectBrowserCode(_ root: Node, allowSQLScripts: Bool) throws {
        try SlopHTML.walk(root) { node in
            guard node.name.first?.isLetter == true || node.name.contains("-") else { return }
            if node.name == "script" {
                let allowed = allowSQLScripts && node.attrs["type"] == "application/sql"
                if !allowed {
                    throw SlopError.invalidArgument("Executable scripts are not allowed in checked views")
                }
            }
            for (name, value) in node.attrs {
                if name.lowercased().hasPrefix("on") {
                    throw SlopError.invalidArgument("Browser event handler \(name) is not allowed")
                }
                if ["href", "src", "action", "formaction"].contains(name.lowercased()),
                   value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().hasPrefix("javascript:") {
                    throw SlopError.invalidArgument("javascript: URLs are not allowed")
                }
            }
        }
    }
}

private struct PlaceholderReference: Hashable {
    let alias: String
    let column: String
}

private func placeholderTokenRegex() -> Regex<(Substring, Substring)> {
    /\{\{\s*([^{}]*?)\s*\}\}/
}

private func placeholderPathRegex() -> Regex<(Substring, Substring, Substring)> {
    /^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/
}

private func placeholderReferences(in value: String) throws -> Set<PlaceholderReference> {
    var references = Set<PlaceholderReference>()
    for match in value.matches(of: placeholderTokenRegex()) {
        let path = String(match.1).trimmingCharacters(in: .whitespacesAndNewlines)
        guard let parsed = path.wholeMatch(of: placeholderPathRegex()) else {
            throw SlopError.invalidArgument("Invalid placeholder {{\(path)}}; expected {{alias.column}}")
        }
        references.insert(PlaceholderReference(alias: String(parsed.1), column: String(parsed.2)))
    }
    if value.replacing(placeholderTokenRegex(), with: "").contains("{{") {
        throw SlopError.invalidArgument("Malformed placeholder; expected {{alias.column}}")
    }
    return references
}

private func replacingPlaceholders(
    in value: String,
    with replace: (PlaceholderReference) throws -> String
) throws -> String {
    var result = ""
    var current = value.startIndex
    for match in value.matches(of: placeholderTokenRegex()) {
        let path = String(match.1).trimmingCharacters(in: .whitespacesAndNewlines)
        guard let parsed = path.wholeMatch(of: placeholderPathRegex()) else {
            throw SlopError.invalidArgument("Invalid placeholder {{\(path)}}; expected {{alias.column}}")
        }
        let reference = PlaceholderReference(alias: String(parsed.1), column: String(parsed.2))
        result.append(contentsOf: value[current..<match.range.lowerBound])
        result.append(try replace(reference))
        current = match.range.upperBound
    }
    result.append(contentsOf: value[current...])
    if result.contains("{{") {
        throw SlopError.invalidArgument("Malformed placeholder; expected {{alias.column}}")
    }
    return result
}
