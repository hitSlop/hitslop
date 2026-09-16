import Foundation
import HTTPTypes
import OpenAPIRuntime

public struct APIHTTPError: LocalizedError, Sendable {
    public let status: Int
    public let message: String
    public var errorDescription: String? { message }
}

/// Preserve HTTP status for host decisions while bounding error response reads.
public struct HTTPMiddleware: ClientMiddleware {
    public var contentType: String?
    public init(contentType: String? = nil) { self.contentType = contentType }
    public func intercept(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String,
                          next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        if let contentType { request.headerFields[.contentType] = contentType }
        let (response, body) = try await next(request, body, baseURL)
        guard (200..<300).contains(response.status.code) else {
            struct ErrorBody: Decodable { let message: String }
            let data: Data?
            if let body { data = try await Data(collecting: body, upTo: 65536) } else { data = nil }
            let message = data.flatMap { try? JSONDecoder().decode(ErrorBody.self, from: $0).message } ?? "Request failed (\(response.status.code))"
            throw APIHTTPError(status: response.status.code, message: message)
        }
        return (response, body)
    }
}
