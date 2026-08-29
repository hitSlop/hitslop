import Foundation
import SlopCore
@testable import SlopTemplates
import XCTest

final class SlopTemplatesTests: XCTestCase {
    private var templatesRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Sources/SlopTemplates/Resources/Templates")
    }

    private var authoredRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Templates")
    }

    private var templateURLs: [URL] {
        (try? FileManager.default.contentsOfDirectory(at: templatesRoot, includingPropertiesForKeys: nil))?
            .filter { $0.pathExtension.lowercased() == "slop" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent } ?? []
    }

    private var authoredTemplateURLs: [URL] {
        (try? FileManager.default.contentsOfDirectory(at: authoredRoot, includingPropertiesForKeys: nil))?
            .filter { FileManager.default.fileExists(atPath: $0.appendingPathComponent("template.json").path) }
            .sorted { $0.lastPathComponent < $1.lastPathComponent } ?? []
    }

    private func matches(_ pattern: String, in text: String) throws -> Set<String> {
        let expression = try NSRegularExpression(pattern: pattern)
        let range = NSRange(text.startIndex..., in: text)
        return Set(expression.matches(in: text, range: range).compactMap { match in
            guard match.numberOfRanges > 1,
                  let range = Range(match.range(at: 1), in: text)
            else { return nil }
            return String(text[range])
        })
    }

    func testBundledTemplatesAreRuntimeOnly() throws {
        XCTAssertGreaterThanOrEqual(templateURLs.count, 16)
        for url in templateURLs {
            let package = try SlopPackage(rootURL: url)
            XCTAssertEqual(package.manifest.format, SlopManifest.supportedFormat, url.lastPathComponent)
            XCTAssertEqual(package.entryURL.lastPathComponent, "index.html")
            XCTAssertEqual(package.styleURL.lastPathComponent, "style.css")
            XCTAssertFalse(FileManager.default.fileExists(atPath: url.appendingPathComponent("source").path))
            let manifest = try XCTUnwrap(
                JSONSerialization.jsonObject(with: Data(contentsOf: package.manifestURL)) as? [String: Any]
            )
            XCTAssertNil(manifest["artifact"])
            XCTAssertNil(manifest["appearance"])
            XCTAssertNil(manifest["runtime"])
            XCTAssertNil(manifest["dependencies"])
            XCTAssertNil(manifest["source"])
        }
    }

    func testAuthoredTemplatesAvoidBannedImports() throws {
        let banned = ["DatePicker", "DateRangePicker", "Calendar", "mode-watcher"]
        let directories = try FileManager.default.contentsOfDirectory(at: authoredRoot, includingPropertiesForKeys: nil)
            .filter { FileManager.default.fileExists(atPath: $0.appendingPathComponent("template.json").path) }
        for url in directories {
            let source = url.appendingPathComponent("source")
            let files = try FileManager.default.subpathsOfDirectory(atPath: source.path)
                .filter { $0.hasSuffix(".svelte") || $0.hasSuffix(".ts") || $0.hasSuffix(".css") }
            for file in files {
                let text = try String(contentsOf: source.appendingPathComponent(file), encoding: .utf8)
                for token in banned {
                    XCTAssertFalse(text.contains(token), "\(url.lastPathComponent) \(file) imports \(token)")
                }
            }
        }
    }

    func testAuthoredTemplatesIncludeCustomShapes() throws {
        var shapeKinds: [String] = []
        for url in authoredTemplateURLs {
            let data = try Data(contentsOf: url.appendingPathComponent("template.json"))
            let manifest = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
            let window = try XCTUnwrap(manifest["window"] as? [String: Any])
            let shape = try XCTUnwrap(window["shape"] as? [String: Any])
            shapeKinds.append(try XCTUnwrap(shape["kind"] as? String))
        }

        XCTAssertTrue(shapeKinds.contains("circle"))
        XCTAssertGreaterThanOrEqual(shapeKinds.filter { $0 == "capsule" }.count, 2)
    }

    func testAuthoredTemplateCSSHasNoUnresolvedVariables() throws {
        for url in authoredTemplateURLs {
            let source = url.appendingPathComponent("source")
            let cssFiles = try FileManager.default.subpathsOfDirectory(atPath: source.path)
                .filter { $0.hasSuffix(".css") }
            for file in cssFiles {
                let text = try String(contentsOf: source.appendingPathComponent(file), encoding: .utf8)
                let used = try matches(#"var\((--[A-Za-z0-9-]+)"#, in: text)
                let declared = try matches(#"(--[A-Za-z0-9-]+)\s*:"#, in: text)
                let unresolved = used.subtracting(declared).filter { !$0.hasPrefix("--bits-") }
                XCTAssertTrue(
                    unresolved.isEmpty,
                    "\(url.lastPathComponent) \(file) has unresolved CSS variables: \(unresolved.sorted())"
                )
            }
        }
    }

    func testBundledTemplatePreviewsExistAndAreDistinct() throws {
        var previews = Set<Data>()
        var thumbnails = Set<Data>()

        for url in templateURLs {
            let quickLook = url.appendingPathComponent("QuickLook", isDirectory: true)
            let preview = try Data(contentsOf: quickLook.appendingPathComponent("Preview.png"))
            let thumbnail = try Data(contentsOf: quickLook.appendingPathComponent("Thumbnail.png"))

            XCTAssertGreaterThan(preview.count, 1_024, url.lastPathComponent)
            XCTAssertGreaterThan(thumbnail.count, 1_024, url.lastPathComponent)
            XCTAssertTrue(previews.insert(preview).inserted, "Duplicate preview for \(url.lastPathComponent)")
            XCTAssertTrue(thumbnails.insert(thumbnail).inserted, "Duplicate thumbnail for \(url.lastPathComponent)")
        }
    }

    func testAuthoredPreviewsAreTheBundledSourceOfTruth() throws {
        for authoredURL in authoredTemplateURLs {
            let data = try Data(contentsOf: authoredURL.appendingPathComponent("template.json"))
            let manifest = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
            let title = try XCTUnwrap(manifest["title"] as? String)
            let bundledURL = templatesRoot.appendingPathComponent("\(title).slop")
            for image in ["Preview.png", "Thumbnail.png"] {
                let authored = try Data(
                    contentsOf: authoredURL.appendingPathComponent("QuickLook/\(image)")
                )
                let bundled = try Data(
                    contentsOf: bundledURL.appendingPathComponent("QuickLook/\(image)")
                )
                XCTAssertEqual(authored, bundled, "Stale \(image) for \(title)")
            }
        }
    }

    func testFieldNotesStillUseStores() throws {
        let fieldNotes = try String(
            contentsOf: authoredRoot.appendingPathComponent("field-notes/source/App.svelte"),
            encoding: .utf8
        )
        let sqliteNotes = try String(
            contentsOf: authoredRoot.appendingPathComponent("sqlite-field-notes/source/App.svelte"),
            encoding: .utf8
        )
        let notebook = try String(
            contentsOf: authoredRoot.appendingPathComponent("notebook/source/App.svelte"),
            encoding: .utf8
        )
        XCTAssertTrue(fieldNotes.contains("jsonStore"))
        XCTAssertTrue(sqliteNotes.contains("sqliteQuery"))
        XCTAssertTrue(notebook.contains("jsonStore"))
        XCTAssertTrue(notebook.contains("bits-ui"))
        XCTAssertFalse(fieldNotes.contains("autofocus"))
        XCTAssertFalse(notebook.contains("autofocus"))
    }

    func testWebTemplatesUseTheLucideIconLanguage() throws {
        var lucideTemplates = 0
        for url in authoredTemplateURLs {
            let sourceURL = url.appendingPathComponent("source/App.svelte")
            let source = try String(contentsOf: sourceURL, encoding: .utf8)
            if source.contains("@lucide/svelte/icons/") { lucideTemplates += 1 }
            XCTAssertFalse(source.contains("phosphor-svelte"), url.lastPathComponent)
        }
        XCTAssertGreaterThanOrEqual(lucideTemplates, 14)
    }
}
