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
                    "Content-Security-Policy": "default-src 'none'; script-src slop: 'unsafe-inline'; style-src slop: 'unsafe-inline'; img-src slop: data:; font-src slop: data:; connect-src slop:;",
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
        switch url.path {
        case "", "/", "/index.html":
            return (
                try entryHTML(),
                "text/html; charset=utf-8"
            )
        case "/slop-base.css":
            let resource = try SlopRuntime.baseStyles()
            return (resource.data, SlopMIME.type(for: resource.url))
        case "/theme.css":
            return (try Data(contentsOf: package.themeURL, options: .mappedIfSafe), "text/css")
        default:
            let assetURL = try package.documentAssetURL(path: url.path)
            guard FileManager.default.fileExists(atPath: assetURL.path) else {
                throw SlopHostError.invalidPackage("Missing document asset: \(url.path)")
            }
            return (try Data(contentsOf: assetURL, options: .mappedIfSafe), SlopMIME.type(for: assetURL))
        }
    }

    private func entryHTML() throws -> Data {
        guard let html = String(data: try Data(contentsOf: package.entryURL), encoding: .utf8) else {
            throw SlopHostError.invalidPackage("build/index.html must be UTF-8 HTML")
        }
        return Data(try Self.injectingHostStyles(into: html).utf8)
    }

    static func injectingHostStyles(into input: String) throws -> String {
        var html = input
        html = html.replacingOccurrences(
            of: #"<link\b[^>]*\bid=["']slop-(?:base|theme)-styles["'][^>]*>"#,
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
        guard let head = html.range(of: #"<head(?:\s[^>]*)?>"#, options: [.regularExpression, .caseInsensitive]) else {
            throw SlopHostError.invalidPackage("build/index.html is missing <head>")
        }
        html.insert(contentsOf: "\n    <link id=\"slop-base-styles\" rel=\"stylesheet\" href=\"./slop-base.css\">", at: head.upperBound)
        guard let closingHead = html.range(of: "</head>", options: .caseInsensitive) else {
            throw SlopHostError.invalidPackage("build/index.html is missing </head>")
        }
        html.insert(contentsOf: "    <link id=\"slop-theme-styles\" rel=\"stylesheet\" href=\"./theme.css\">\n  ", at: closingHead.lowerBound)
        return html
    }
}
