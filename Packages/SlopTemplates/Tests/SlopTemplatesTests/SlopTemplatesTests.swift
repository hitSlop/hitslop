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

    private var themesRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Sources/SlopTemplates/Resources/Themes")
    }

    private var templateURLs: [URL] {
        (try? FileManager.default.contentsOfDirectory(at: templatesRoot, includingPropertiesForKeys: nil))?
            .filter { $0.pathExtension.lowercased() == "slop" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent } ?? []
    }

    func testBundledTemplatesValidateAndHashesMatch() throws {
        XCTAssertGreaterThanOrEqual(templateURLs.count, 5)
        for url in templateURLs {
            let package = try SlopPackage(rootURL: url)
            XCTAssertEqual(package.manifest.format, SlopManifest.supportedFormat, url.lastPathComponent)
            XCTAssertEqual(package.entryURL.lastPathComponent, "index.html")
            XCTAssertTrue(package.isSourceCurrent, url.lastPathComponent)
            XCTAssertTrue(package.isArtifactCurrent, url.lastPathComponent)
            let names = Set(package.sourceURLs.map(\.lastPathComponent))
            XCTAssertTrue(names.contains("App.svelte"), url.lastPathComponent)
            XCTAssertTrue(names.contains("main.ts"), url.lastPathComponent)
            XCTAssertTrue(names.contains("styles.css"), url.lastPathComponent)
            let manifest = try XCTUnwrap(
                JSONSerialization.jsonObject(with: Data(contentsOf: package.manifestURL)) as? [String: Any]
            )
            XCTAssertNil(manifest["runtime"])
            XCTAssertNil(manifest["dependencies"])
            XCTAssertNil(manifest["source"])
        }
    }

    func testBundledTemplatesAvoidBannedImportsAndPaletteUtilities() throws {
        let banned = ["DatePicker", "DateRangePicker", "Calendar", "mode-watcher"]
        let palette = try NSRegularExpression(pattern: #"\b(bg|text|border)-(blue|zinc|slate|red|green|gray)-\d|#\[|bg-\[#"#)
        for url in templateURLs {
            let source = url.appendingPathComponent("source")
            let files = try FileManager.default.subpathsOfDirectory(atPath: source.path)
                .filter { $0.hasSuffix(".svelte") || $0.hasSuffix(".ts") || $0.hasSuffix(".css") }
            for file in files {
                let text = try String(contentsOf: source.appendingPathComponent(file), encoding: .utf8)
                for token in banned {
                    XCTAssertFalse(text.contains(token), "\(url.lastPathComponent) \(file) imports \(token)")
                }
                XCTAssertEqual(
                    palette.numberOfMatches(in: text, range: NSRange(text.startIndex..., in: text)),
                    0,
                    "\(url.lastPathComponent) \(file) uses raw palette utilities"
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

    func testBundledThemesAreTokenSheets() throws {
        let urls = try FileManager.default.contentsOfDirectory(at: themesRoot, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "sloptheme" }
        XCTAssertGreaterThanOrEqual(urls.count, 6)
        for url in urls {
            let data = try Data(contentsOf: url.appendingPathComponent("manifest.json"))
            let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
            XCTAssertEqual(json["format"] as? String, "slop-theme/1", url.lastPathComponent)
            let preview = try XCTUnwrap(json["preview"] as? [String: Any])
            let colors = try XCTUnwrap(preview["colors"] as? [String])
            XCTAssertGreaterThanOrEqual(colors.count, 3, url.lastPathComponent)
            let css = try Data(contentsOf: url.appendingPathComponent("theme.css"))
            XCTAssertLessThanOrEqual(css.count, 512 * 1_024)
            let text = try XCTUnwrap(String(data: css, encoding: .utf8))
            XCTAssertFalse(text.contains("button {"), url.lastPathComponent)
            XCTAssertFalse(text.contains("#status"), url.lastPathComponent)
        }
    }

    func testFieldNotesStillUseStores() throws {
        let fieldNotes = try String(
            contentsOf: templatesRoot.appendingPathComponent("Field Notes.slop/source/App.svelte"),
            encoding: .utf8
        )
        let sqliteNotes = try String(
            contentsOf: templatesRoot.appendingPathComponent("SQLite Field Notes.slop/source/App.svelte"),
            encoding: .utf8
        )
        let notebook = try String(
            contentsOf: templatesRoot.appendingPathComponent("Notebook.slop/source/App.svelte"),
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
        for name in ["Invoice.slop", "Notebook.slop"] {
            let source = try String(
                contentsOf: templatesRoot.appendingPathComponent("\(name)/source/App.svelte"),
                encoding: .utf8
            )
            XCTAssertTrue(source.contains("@lucide/svelte/icons/"), name)
            XCTAssertFalse(source.contains("phosphor-svelte"), name)
        }
    }
}
