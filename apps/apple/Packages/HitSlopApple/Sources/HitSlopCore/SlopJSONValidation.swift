import DynamicJSON
import Foundation

/// The same format-asserting dialect for manifests and document data.
package enum SlopJSONValidation {
    package static var dialect: JSONSchemaDraft2020.Dialect {
        var formats = JSONSchemaFormatValidators.draft2020
        // Foundation's default URL initializer repairs spaces and malformed
        // percent escapes. Schema validation must check the original string.
        formats["uri"] = { value in
            guard value.allSatisfy(\.isASCII), !value.contains("\\"),
                  let url = URL(string: value, encodingInvalidCharacters: false) else { return false }
            return url.scheme != nil
        }
        formats["uri-reference"] = { value in
            value.isEmpty || (value.allSatisfy(\.isASCII) && !value.contains("\\") && URL(string: value, encodingInvalidCharacters: false) != nil)
        }
        return .init(vocabulary: .init(formatValid: true, formatValidators: formats))
    }
}
