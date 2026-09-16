import Foundation

public struct SlopDocumentFrame: Codable, Equatable, Sendable {
    public let publication: Int
    public let revision: String
    public let data: SlopDocumentJSON
    public let dirty: Bool
    public let error: String?
    public let projectionError: String?
    public init(publication: Int, revision: String, data: SlopDocumentJSON, dirty: Bool, error: String?, projectionError: String?) {
        self.publication = publication
        self.revision = revision
        self.data = data
        self.dirty = dirty
        self.error = error
        self.projectionError = projectionError
    }
    public func encode(to encoder: any Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(publication, forKey: .publication)
        try values.encode(revision, forKey: .revision)
        try values.encode(data, forKey: .data)
        try values.encode(dirty, forKey: .dirty)
        try values.encode(error, forKey: .error)
        try values.encode(projectionError, forKey: .projectionError)
    }
    public func jsonValue() throws -> Any {
        let publicFrame = Self(publication: publication, revision: revision, data: data, dirty: dirty,
            error: error == nil ? nil : "Document synchronization needs attention in hitSlop",
            projectionError: projectionError == nil ? nil : "External document data needs review in hitSlop")
        return try JSONSerialization.jsonObject(with: JSONEncoder().encode(publicFrame))
    }
}

public struct SlopDocumentEdit: Codable, Equatable, Sendable {
    public let session: String
    public let sequence: Int
    public let base: String
    public let after: SlopDocumentJSON
    public let draft: String?
    public let parent: Int?
    public init(session: String, sequence: Int, base: String, after: SlopDocumentJSON, draft: String? = nil, parent: Int? = nil) {
        self.session = session
        self.sequence = sequence
        self.base = base
        self.after = after
        self.draft = draft
        self.parent = parent
    }
}

public enum SlopLoroTransport: String, Codable, Sendable {
    case local, incremental
}
