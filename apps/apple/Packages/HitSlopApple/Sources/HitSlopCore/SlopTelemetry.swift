import Foundation

/// Only fixed product events cross this boundary; document values never enter telemetry.
public enum SlopTelemetryEvent: Equatable, Sendable {
    public enum TemplateSource: String, Sendable { case bundled, installed }
    public enum ExportFormat: String, Sendable { case png, pdf }
    public enum Failure: String, Sendable { case create, open, save, export, renderer }
    case launched, opened, duplicated
    case created(TemplateSource)
    case exported(ExportFormat)
    case failed(Failure)
}

@MainActor public struct SlopTelemetry {
    private let receive: (SlopTelemetryEvent) -> Void
    public init(send: @escaping (SlopTelemetryEvent) -> Void) { self.receive = send }
    public func send(_ event: SlopTelemetryEvent) { receive(event) }
    public static let disabled = Self { _ in }
}
