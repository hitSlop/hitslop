import FirebaseAnalytics
import FirebaseAppCheck
import FirebaseCore
import FirebaseCrashlytics
import Foundation

public enum HitSlopFirebase {
    /// Opt in from the Xcode scheme. A Debug build alone must not reroute traffic.
    public static var usesEmulators: Bool {
        #if DEBUG
        ProcessInfo.processInfo.environment["HITSLOP_USE_FIREBASE_EMULATORS"] == "1"
        #else
        false
        #endif
    }

    public static func catalogURL(default url: URL) -> URL {
        usesEmulators ? URL(string: "http://127.0.0.1:5002")! : url
    }

    public static func configure() {
        guard FirebaseApp.allApps?.isEmpty != false else { return }
        #if DEBUG
        if usesEmulators {
            AppCheck.setAppCheckProviderFactory(LocalEmulatorAppCheckProviderFactory())
        } else {
            AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
        }
        #elseif os(macOS)
        AppCheck.setAppCheckProviderFactory(DeviceCheckProviderFactory())
        #else
        AppCheck.setAppCheckProviderFactory(AppAttestProviderFactory())
        #endif
        FirebaseApp.configure()
        #if DEBUG
        let telemetryEnabled = false
        #else
        let telemetryEnabled = true
        #endif
        Crashlytics.crashlytics().setCrashlyticsCollectionEnabled(telemetryEnabled)
        Analytics.setAnalyticsCollectionEnabled(telemetryEnabled)
    }

    public static func log(_ name: String, parameters: [String: Any]? = nil) {
        guard FirebaseApp.app() != nil else { return }
        Analytics.logEvent(name, parameters: parameters)
    }

    public static func record(_ error: Error) {
        guard FirebaseApp.app() != nil else { return }
        Crashlytics.crashlytics().record(error: error)
    }
}

#if DEBUG
private final class LocalEmulatorAppCheckProvider: NSObject, AppCheckProvider {
    func getToken(completion handler: @escaping (AppCheckToken?, Error?) -> Void) {
        handler(AppCheckToken(token: "local-emulator", expirationDate: .distantFuture), nil)
    }
}

private final class LocalEmulatorAppCheckProviderFactory: NSObject, AppCheckProviderFactory {
    func createProvider(with app: FirebaseApp) -> AppCheckProvider? {
        LocalEmulatorAppCheckProvider()
    }
}
#endif
