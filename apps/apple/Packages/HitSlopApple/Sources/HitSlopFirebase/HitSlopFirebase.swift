import FirebaseAnalytics
import FirebaseCore
import FirebaseCrashlytics
import Foundation
import HitSlopCore

public enum HitSlopFirebase {
    public static func configure() {
        guard FirebaseApp.allApps?.isEmpty != false else { return }
        FirebaseApp.configure()
        #if DEBUG
        let telemetryEnabled = false
        #else
        let telemetryEnabled = true
        #endif
        Crashlytics.crashlytics().setCrashlyticsCollectionEnabled(telemetryEnabled)
        Analytics.setAnalyticsCollectionEnabled(telemetryEnabled)
    }

    @MainActor public static let telemetry = SlopTelemetry { event in
        #if !DEBUG
        guard FirebaseApp.app() != nil else { return }
        switch event {
        case .launched: Analytics.logEvent("app_launched", parameters: nil)
        case .opened: Analytics.logEvent("document_opened", parameters: nil)
        case .duplicated: Analytics.logEvent("document_duplicated", parameters: nil)
        case .created(let source):
            Analytics.logEvent("document_created", parameters: ["source": source.rawValue])
        case .exported(let format):
            Analytics.logEvent("document_exported", parameters: ["format": format.rawValue])
        case .failed(let operation):
            // Do not forward Error/userInfo: these can contain file paths and authored data.
            Crashlytics.crashlytics().record(error: NSError(
                domain: "com.hitslop.operation", code: 1,
                userInfo: [NSLocalizedDescriptionKey: operation.rawValue]))
        }
        #endif
    }
}
