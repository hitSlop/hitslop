import Foundation

public struct SlopSQLShape: Equatable, Sendable {
    public let sql: String
    public let params: [String]
}

/// Rejects SQL tails and recognizes only `:name` parameters outside literals/comments.
public func inspectSlopSQL(_ sql: String) throws -> SlopSQLShape {
    var clean = ""
    var state = SQLScan.code
    var params = Set<String>()
    let chars = Array(sql)

    var index = 0
    while index < chars.count {
        let char = chars[index]
        let next = index + 1 < chars.count ? chars[index + 1] : nil

        switch state {
        case .single:
            clean.append(" ")
            if char == "'" && next == "'" {
                clean.append(" ")
                index += 2
                continue
            }
            if char == "'" { state = .code }
        case .double:
            clean.append(" ")
            if char == "\"" && next == "\"" {
                clean.append(" ")
                index += 2
                continue
            }
            if char == "\"" { state = .code }
        case .line:
            clean.append(char == "\n" ? "\n" : " ")
            if char == "\n" { state = .code }
        case .block:
            clean.append(" ")
            if char == "*" && next == "/" {
                clean.append(" ")
                index += 2
                state = .code
                continue
            }
        case .code:
            if char == "'" {
                state = .single
                clean.append(" ")
            } else if char == "\"" {
                state = .double
                clean.append(" ")
            } else if char == "-" && next == "-" {
                state = .line
                clean.append("  ")
                index += 2
                continue
            } else if char == "/" && next == "*" {
                state = .block
                clean.append("  ")
                index += 2
                continue
            } else {
                clean.append(char)
                if char == "?" {
                    throw SlopError.invalidArgument("Use named :parameters, not positional parameters")
                }
                if (char == "$" || char == "@"), let next, next.isSQLIdentifierStart {
                    throw SlopError.invalidArgument("Only :name parameters are supported")
                }
                if char == ":", let next, next.isSQLIdentifierStart {
                    var end = index + 2
                    while end < chars.count, chars[end].isSQLIdentifierContinue {
                        end += 1
                    }
                    params.insert(String(chars[(index + 1)..<end]))
                }
            }
        }
        index += 1
    }

    if state == .single || state == .double || state == .block {
        throw SlopError.invalidArgument("Unterminated SQL literal or comment")
    }

    let statements = clean.split(separator: ";").filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    guard statements.count == 1 else {
        throw SlopError.invalidArgument("Exactly one SQL statement is required")
    }

    let trimmed = sql.trimmingCharacters(in: .whitespacesAndNewlines)
    let keyword = String(clean.trimmingCharacters(in: .whitespacesAndNewlines).prefix { $0.isLetter }).uppercased()
    if ["BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "RELEASE"].contains(keyword) {
        throw SlopError.invalidArgument("The host owns transactions; BEGIN/COMMIT/ROLLBACK are not allowed")
    }

    return SlopSQLShape(sql: trimmed, params: params.sorted())
}

private enum SQLScan {
    case code, single, double, line, block
}

private extension Character {
    var isSQLIdentifierStart: Bool {
        self == "_" || isLetter
    }

    var isSQLIdentifierContinue: Bool {
        self == "_" || isLetter || isNumber
    }
}
