import FirebaseAnalytics
import FirebaseAppCheck
import FirebaseCore
import FirebaseCrashlytics
import Foundation

public enum HitSlopFirebase {
    public static func configure() {
        guard FirebaseApp.allApps?.isEmpty != false else { return }
        #if DEBUG
        AppCheck.setAppCheckProviderFactory(LocalEmulatorAppCheckProviderFactory())
        #elseif os(macOS)
        AppCheck.setAppCheckProviderFactory(DeviceCheckProviderFactory())
        #else
        AppCheck.setAppCheckProviderFactory(AppAttestProviderFactory())
        #endif
        FirebaseApp.configure()
        Crashlytics.crashlytics().setCrashlyticsCollectionEnabled(true)
        Analytics.setAnalyticsCollectionEnabled(true)
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
