import Foundation
import HitSlopCore

enum SlopTheme {
    /// A deliberately small CSS surface: one root rule, custom properties only.
    static func properties(_ css: String) throws -> Set<String> {
        var clean = "", quote: Character?, escaped = false, comment = false
        let characters = Array(css)
        var index = 0
        while index < characters.count {
            let c = characters[index], next = index + 1 < characters.count ? characters[index + 1] : "\0"
            if comment {
                if c == "*", next == "/" { comment = false; index += 2; continue }
            } else if let currentQuote = quote {
                clean.append(c)
                if escaped { escaped = false }
                else if c == "\\" { escaped = true }
                else if c == currentQuote { quote = nil }
            } else if c == "/", next == "*" { comment = true; index += 2; continue }
            else { clean.append(c); if c == "\"" || c == "'" { quote = c } }
            index += 1
        }
        guard !comment, quote == nil else { throw invalid() }
        clean = clean.trimmingCharacters(in: .whitespacesAndNewlines)
        guard clean.hasPrefix(":root"), let open = clean.firstIndex(of: "{"), clean.last == "}", clean[..<open].trimmingCharacters(in: .whitespacesAndNewlines) == ":root" else { throw invalid() }
        let body = clean[clean.index(after: open)..<clean.index(before: clean.endIndex)]
        var declarations: [String] = [], declaration = "", depth = 0
        quote = nil; escaped = false
        for c in body {
            if let currentQuote = quote {
                declaration.append(c)
                if escaped { escaped = false }
                else if c == "\\" { escaped = true }
                else if c == currentQuote { quote = nil }
                continue
            }
            if c == "\"" || c == "'" { quote = c }
            if c == "(" { depth += 1 }
            if c == ")" { depth -= 1 }
            guard depth >= 0, c != "{", c != "}" else { throw invalid() }
            if c == ";", depth == 0 { declarations.append(declaration); declaration = "" }
            else { declaration.append(c) }
        }
        guard quote == nil, depth == 0 else { throw invalid() }
        declarations.append(declaration)
        var result = Set<String>()
        for item in declarations {
            let item = item.trimmingCharacters(in: .whitespacesAndNewlines)
            if item.isEmpty { continue }
            guard let colon = item.firstIndex(of: ":") else { throw invalid() }
            let name = String(item[..<colon]).trimmingCharacters(in: .whitespacesAndNewlines)
            let value = item[item.index(after: colon)...].trimmingCharacters(in: .whitespacesAndNewlines)
            guard name.range(of: "^--slop-[a-z0-9-]+$", options: .regularExpression) != nil, !value.isEmpty, result.insert(name).inserted else { throw invalid() }
        }
        guard !result.isEmpty else { throw invalid() }
        return result
    }

    static func validate(_ css: String, contract: Set<String>) throws {
        guard try properties(css).isSubset(of: contract) else { throw SlopBridgeFailure(.validationFailed, "Theme override contains unknown tokens") }
        let regex = try NSRegularExpression(pattern: #"var\(\s*(--slop-[a-z0-9-]+)"#, options: [.caseInsensitive])
        let text = css as NSString
        for match in regex.matches(in: css, range: NSRange(location: 0, length: text.length)) {
            guard contract.contains(text.substring(with: match.range(at: 1))) else { throw SlopBridgeFailure(.validationFailed, "Theme references an unknown token") }
        }
    }
    private static func invalid() -> SlopBridgeFailure { .init(.validationFailed, "Theme must contain one :root rule with nonempty --slop-* declarations") }
}
