import Foundation
import SlopCore
import WebKit

final class SlopSchemeHandler: NSObject, WKURLSchemeHandler {
    private let package: SlopPackage

    init(package: SlopPackage) {
        self.package = package
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(SlopHostError.invalidPackage("Missing resource URL"))
            return
        }
        do {
            let resource = try resource(for: url)
            guard let response = HTTPURLResponse(
                url: url,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": resource.mime,
                    "Content-Length": String(resource.data.count),
                    "Cache-Control": "no-store",
                    "Cross-Origin-Resource-Policy": "same-origin",
                ]
            ) else {
                throw SlopHostError.invalidPackage("Could not create a response for \(url.path)")
            }
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(resource.data)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {}

    private func resource(for url: URL) throws -> (data: Data, mime: String) {
        guard package.usesHostRuntime else {
            let assetURL = try package.webAssetURL(path: url.path)
            guard FileManager.default.fileExists(atPath: assetURL.path) else {
                throw SlopHostError.invalidPackage("Missing web asset: \(url.path)")
            }
            return (try Data(contentsOf: assetURL, options: .mappedIfSafe), SlopMIME.type(for: assetURL))
        }

        switch url.path {
        case "", "/":
            let resource = try SlopRuntime.shell()
            return (resource.data, SlopMIME.type(for: resource.url))
        case "/slop-runtime-1.js":
            let resource = try SlopRuntime.loader()
            return (resource.data, SlopMIME.type(for: resource.url))
        case "/app.wasm":
            return (try Data(contentsOf: package.entryURL, options: .mappedIfSafe), "application/wasm")
        case "/app.css":
            guard let styleURL = package.styleURL else {
                return (Data(), "text/css")
            }
            return (try Data(contentsOf: styleURL, options: .mappedIfSafe), "text/css")
        default:
            let assetURL = try package.documentAssetURL(path: url.path)
            guard FileManager.default.fileExists(atPath: assetURL.path) else {
                throw SlopHostError.invalidPackage("Missing document asset: \(url.path)")
            }
            return (try Data(contentsOf: assetURL, options: .mappedIfSafe), SlopMIME.type(for: assetURL))
        }
    }
}
