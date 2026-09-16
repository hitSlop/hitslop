import Foundation
import HTTPTypes
import OpenAPIRuntime

/// Authentication is supplied by the host, never by the guest WebView.
public struct APIAuthorization: ClientMiddleware {
    public let token: @Sendable () async throws -> String?
    public init(token: @escaping @Sendable () async throws -> String?) { self.token = token }
    public func intercept(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String,
                          next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        if let token = try await token() { request.headerFields[.authorization] = "Bearer \(token)" }
        return try await next(request, body, baseURL)
    }
}
