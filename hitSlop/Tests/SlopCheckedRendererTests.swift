import Foundation
import SQLite3
import XCTest
#if SWIFT_PACKAGE
@testable import SlopCore
#endif

final class SlopCheckedRendererTests: XCTestCase {
    func testHTMLAdapterParsesCustomElementsTemplatesAndScripts() throws {
        let html = """
        <!doctype html><html><head></head><body>
        <slop-each as="item">
          <script type="application/sql">SELECT 1</script>
          <template><li id="row-{{item.id}}">{{item.name}}</li></template>
        </slop-each>
        </body></html>
        """
        let document = try SlopHTML.parseDocument(html)
        let each = try SlopHTML.query(document, "slop-each").first
        XCTAssertEqual(each?.name, "slop-each")
        XCTAssertEqual(each?.attrs["as"], "item")
        let script = SlopHTML.directChildren(each!, named: "script").first
        XCTAssertEqual(SlopHTML.textContent(script!), "SELECT 1")
        let template = SlopHTML.directChildren(each!, named: "template").first
        XCTAssertEqual(template?.templateContent?.children.first?.name, "li")
        XCTAssertTrue(SlopHTML.serialize(document).contains("<slop-each as=item>"))
    }

    func testHTMLAdapterEscapesHostileTextAndAttributes() throws {
        let document = try SlopHTML.parseDocument(
            "<!doctype html><html><head></head><body><p data-value=\"\">x</p></body></html>"
        )
        let paragraph = try XCTUnwrap(try SlopHTML.query(document, "p").first)
        let payload = "<img src=x onerror=\"alert(1)\">"
        let text = try XCTUnwrap(paragraph.children.first { $0.name == "#text" })
        SlopHTML.setText(text, payload)
        paragraph.attrs["data-value"] = payload
        let output = SlopHTML.serialize(document)
        XCTAssertTrue(output.contains("&lt;img src=x onerror="), output)
        let reparsed = try SlopHTML.parseDocument(output)
        XCTAssertEqual(try SlopHTML.query(reparsed, "p").first?.attrs["data-value"], payload)
        XCTAssertTrue(try SlopHTML.query(reparsed, "img").isEmpty, output)
    }

    func testFragmentRoundTripForListTableAndOption() throws {
        let list = try SlopHTML.parseTemplate("<li>Item</li>")
        XCTAssertEqual(list.children.first?.name, "li")
        let row = try SlopHTML.parseFragment("<tr><td>Cell</td></tr>", context: "tbody")
        XCTAssertTrue(SlopHTML.serialize(row).contains("<td>Cell</td>"))
        let option = try SlopHTML.parseTemplate("<option>Pick</option>")
        XCTAssertEqual(option.children.first?.name, "option")
    }

    func testInspectSQLRejectsTailsAndNonNamedParameters() throws {
        XCTAssertEqual(try inspectSlopSQL("UPDATE recipe SET title=:title WHERE id=:id;").params, ["id", "title"])
        XCTAssertThrowsError(try inspectSlopSQL("SELECT 1; DELETE FROM recipe"))
        XCTAssertThrowsError(try inspectSlopSQL("SELECT ?"))
        XCTAssertThrowsError(try inspectSlopSQL("SELECT $value"))
        XCTAssertThrowsError(try inspectSlopSQL("BEGIN"))
    }

    func testRendererExpandsQueriesAndStripsActionSQL() throws {
        let package = try makeCheckedFixture()
        defer { try? FileManager.default.removeItem(at: package.deletingLastPathComponent()) }
        let database = try SlopDatabase(packageURL: package)
        let html = try SlopCheckedRenderer(database: database).render()
        XCTAssertTrue(html.contains("Pasta"))
        XCTAssertTrue(html.contains("Guanciale"))
        XCTAssertTrue(html.contains("ingredient-1"))
        XCTAssertFalse(html.contains("SELECT title"))
        XCTAssertFalse(html.contains("application/sql"))
        XCTAssertFalse(html.contains("slop-row"))
        XCTAssertFalse(html.contains("slop-each"))
        XCTAssertTrue(html.contains("data-slop-action=toggle"))
    }

    func testSlopRowRequiresExactlyOneResult() throws {
        let zero = try makeCheckedFixture(extraSQL: "DELETE FROM recipe;")
        defer { try? FileManager.default.removeItem(at: zero.deletingLastPathComponent()) }
        XCTAssertThrowsError(try SlopCheckedRenderer(database: SlopDatabase(packageURL: zero)).render()) { error in
            XCTAssertTrue(String(describing: error).contains("expected exactly one row; query returned 0"))
        }

        let multiple = try makeCheckedFixture(extraSQL: "INSERT INTO recipe VALUES ('Second');")
        defer { try? FileManager.default.removeItem(at: multiple.deletingLastPathComponent()) }
        XCTAssertThrowsError(try SlopCheckedRenderer(database: SlopDatabase(packageURL: multiple)).render()) { error in
            XCTAssertTrue(String(describing: error).contains("expected exactly one row; query returned 2"))
        }
    }

    func testNamedActionPersistsAndEscapesMarkup() throws {
        let package = try makeCheckedFixture()
        defer { try? FileManager.default.removeItem(at: package.deletingLastPathComponent()) }
        let database = try SlopDatabase(packageURL: package)
        let renderer = SlopCheckedRenderer(database: database)
        let payload = "<img src=x onerror=\"alert(1)\">"
        let html = try renderer.performAction(name: "add", params: ["name": payload])
        XCTAssertTrue(html.contains("&lt;img src=x onerror="))
        XCTAssertFalse(html.contains("<span class=\"name\">\(payload)</span>"))
        XCTAssertEqual(
            try database.query("SELECT name FROM items ORDER BY id DESC LIMIT 1").first?["name"] as? String,
            payload
        )
        XCTAssertEqual(try database.revision(), 1)
    }

    func testFailedActionDoesNotBumpRevision() throws {
        let package = try makeCheckedFixture()
        defer { try? FileManager.default.removeItem(at: package.deletingLastPathComponent()) }
        let database = try SlopDatabase(packageURL: package)
        let renderer = SlopCheckedRenderer(database: database)
        XCTAssertThrowsError(try renderer.performAction(name: "add", params: [:]))
        XCTAssertEqual(try database.revision(), 0)
        XCTAssertEqual(try database.query("SELECT count(*) AS n FROM items").first?["n"] as? Int64, 2)
    }

    func testZeroRowsNullAndMissingPlaceholder() throws {
        let package = try makeCheckedFixture(extraSQL: "DELETE FROM items;")
        defer { try? FileManager.default.removeItem(at: package.deletingLastPathComponent()) }
        let database = try SlopDatabase(packageURL: package)
        let html = try SlopCheckedRenderer(database: database).render()
        XCTAssertFalse(html.contains("ingredient-"))
        XCTAssertTrue(html.contains("<h1>Pasta</h1>"))

        let bad = try makeCheckedFixture(viewMutator: { $0.replacingOccurrences(of: "{{item.name}}", with: "{{item.missing}}") })
        defer { try? FileManager.default.removeItem(at: bad.deletingLastPathComponent()) }
        let badDB = try SlopDatabase(packageURL: bad)
        XCTAssertThrowsError(try SlopCheckedRenderer(database: badDB).compile())
    }

    func testRejectsNestedQueriesWriteQueriesAndScripts() throws {
        let nested = try makeCheckedFixture(viewMutator: { view in
            guard view.contains("<template>") else { return view }
            return view.replacingOccurrences(
                of: "<template>",
                with: "<template><slop-each as=\"nested\"><script type=\"application/sql\">SELECT 1 AS value</script><template><span>{{nested.value}}</span></template></slop-each>",
                options: [],
                range: view.range(of: "<template>")
            )
        })
        defer { try? FileManager.default.removeItem(at: nested.deletingLastPathComponent()) }
        XCTAssertThrowsError(try SlopCheckedRenderer(database: try SlopDatabase(packageURL: nested)).compile())

        let write = try makeCheckedFixture(viewMutator: { $0.replacingOccurrences(of: "SELECT title FROM recipe", with: "DELETE FROM items") })
        defer { try? FileManager.default.removeItem(at: write.deletingLastPathComponent()) }
        XCTAssertThrowsError(try SlopCheckedRenderer(database: try SlopDatabase(packageURL: write)).compile())

        let script = try makeCheckedFixture(viewMutator: { $0.replacingOccurrences(of: "</body>", with: "<script>alert(1)</script></body>") })
        defer { try? FileManager.default.removeItem(at: script.deletingLastPathComponent()) }
        XCTAssertThrowsError(try SlopCheckedRenderer(database: try SlopDatabase(packageURL: script)).compile())
    }

    func testRejectsInvalidRegionScopesAndLegacyQueryRegions() throws {
        let mutations: [(String, (String) -> String)] = [
            ("missing alias", { $0.replacingOccurrences(of: "<slop-row as=\"recipe\">", with: "<slop-row>") }),
            ("unqualified placeholder", { $0.replacingOccurrences(of: "{{recipe.title}}", with: "{{title}}") }),
            ("wrong alias", { $0.replacingOccurrences(of: "{{recipe.title}}", with: "{{other.title}}") }),
            ("placeholder outside loop", { $0.replacingOccurrences(of: "<title>Checked</title>", with: "<title>{{recipe.title}}</title>") }),
            ("malformed path", { $0.replacingOccurrences(of: "{{recipe.title}}", with: "{{recipe.title.extra}}") }),
            ("legacy region", {
                $0.replacingOccurrences(of: "slop-each", with: "slop-query")
            }),
        ]

        for (name, mutate) in mutations {
            let package = try makeCheckedFixture(viewMutator: mutate)
            defer { try? FileManager.default.removeItem(at: package.deletingLastPathComponent()) }
            XCTAssertThrowsError(
                try SlopCheckedRenderer(database: SlopDatabase(packageURL: package)).compile(),
                name
            )
        }
    }

    func testPackValidatesCheckedRecipeCard() throws {
        let source = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("TemplateSources/Recipe Card")
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let packed = try SlopPackage.pack(from: source, to: root.appendingPathComponent("Recipe Card.slop"))
        let database = try SlopDatabase(packageURL: packed)
        let html = try SlopCheckedRenderer.displayHTML(from: database)
        XCTAssertTrue(html.contains("Pasta Carbonara"))
        XCTAssertTrue(html.contains("guanciale"))
        XCTAssertFalse(html.contains("application/sql"))
        XCTAssertFalse(try database.mainHTML().contains("<script src"))
        XCTAssertTrue(try database.mainHTML().contains("sql-html-v1"))
    }

    func testPackValidatesCheckedHabitTracker() throws {
        let source = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("TemplateSources/Habit Tracker")
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let packed = try SlopPackage.pack(from: source, to: root.appendingPathComponent("Habit Tracker.slop"))
        let database = try SlopDatabase(packageURL: packed)
        let html = try SlopCheckedRenderer.displayHTML(from: database)
        XCTAssertTrue(html.contains("Exercise"))
        XCTAssertTrue(html.contains("habit-1"))
        XCTAssertTrue(html.contains("data-slop-action=toggle-check"))
        XCTAssertFalse(html.contains("application/sql"))
        XCTAssertFalse(html.contains("slop-row"))
        XCTAssertFalse(html.contains("slop-each"))
        XCTAssertFalse(try database.mainHTML().contains("slop.query"))
    }

    func testHabitTrackerNamedActionsPersistAndRerender() throws {
        let source = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("TemplateSources/Habit Tracker")
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let packed = try SlopPackage.pack(from: source, to: root.appendingPathComponent("Habit Tracker.slop"))
        let database = try SlopDatabase(packageURL: packed)
        let renderer = SlopCheckedRenderer(database: database)

        _ = try renderer.performAction(name: "update-title", params: ["title": "My Week"])
        _ = try renderer.performAction(name: "update-habit", params: ["id": "1", "name": "Morning walk"])
        let day = try XCTUnwrap(try database.query("SELECT day_0 FROM habit_week WHERE id = 1").first?["day_0"] as? String)
        _ = try renderer.performAction(name: "toggle-check", params: ["habit_id": "1", "day": day])
        _ = try renderer.performAction(name: "add-habit", params: ["name": "Stretch"])
        let addedID = try XCTUnwrap(try database.query("SELECT max(id) AS id FROM habits").first?["id"] as? Int64)
        let html = try renderer.performAction(name: "remove-habit", params: ["id": String(addedID)])

        XCTAssertEqual(try database.query("SELECT title FROM habit_settings").first?["title"] as? String, "My Week")
        XCTAssertEqual(try database.query("SELECT name FROM habits WHERE id = 1").first?["name"] as? String, "Morning walk")
        XCTAssertEqual(try database.query("SELECT completed FROM habit_checks WHERE habit_id = 1 AND day = ?", parameters: [day]).first?["completed"] as? Int64, 0)
        XCTAssertEqual(try database.query("SELECT count(*) AS n FROM habits WHERE id = ?", parameters: [addedID]).first?["n"] as? Int64, 0)
        XCTAssertTrue(html.contains("My Week"))
        XCTAssertTrue(html.contains("Morning walk"))
        XCTAssertEqual(try database.revision(), 5)
    }

    private func makeCheckedFixture(extraSQL: String = "", viewMutator: ((String) -> String)? = nil) throws -> URL {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let package = root.appendingPathComponent("Checked.slop")
        try FileManager.default.createDirectory(at: package, withIntermediateDirectories: true)
        let sqliteURL = package.appendingPathComponent(slopDatabaseName)
        var handle: OpaquePointer?
        guard sqlite3_open(sqliteURL.path, &handle) == SQLITE_OK else { throw SlopError.sqlite("fixture open failed") }
        defer { sqlite3_close(handle) }

        var view = """
        <!doctype html>
        <html><head>
          <meta name="hitslop-renderer" content="sql-html-v1">
          <title>Checked</title>
        </head>
        <body>
          <slop-row as="recipe">
            <script type="application/sql">SELECT title FROM recipe</script>
            <template><h1>{{recipe.title}}</h1></template>
          </slop-row>
          <ul>
            <slop-each as="item">
              <script type="application/sql">SELECT id, name, note FROM items ORDER BY id</script>
              <template>
                <li class="ingredient" id="ingredient-{{item.id}}">
                  <span class="name">{{item.name}}</span>
                  <span>{{item.note}}</span>
                  <form data-slop-action="toggle">
                    <input type="hidden" name="id" value="{{item.id}}">
                    <button type="submit">Toggle</button>
                  </form>
                </li>
              </template>
            </slop-each>
          </ul>
          <form data-slop-action="add">
            <input name="name">
            <button type="submit">Add</button>
          </form>
          <script type="application/sql" data-slop-action="toggle">
            UPDATE items SET name = name WHERE id = CAST(:id AS INTEGER)
          </script>
          <script type="application/sql" data-slop-action="add">
            INSERT INTO items(name) VALUES (:name)
          </script>
        </body></html>
        """
        if let viewMutator { view = viewMutator(view) }
        let escaped = view.replacingOccurrences(of: "'", with: "''")

        let sql = """
        PRAGMA application_id = 1397509968;
        PRAGMA user_version = 2;
        CREATE TABLE slop_meta(key TEXT PRIMARY KEY, value ANY);
        CREATE TABLE slop_view(path TEXT PRIMARY KEY, mime TEXT NOT NULL, body TEXT NOT NULL);
        CREATE TABLE slop_docs(topic TEXT PRIMARY KEY, body TEXT NOT NULL);
        CREATE TABLE slop_assets(path TEXT PRIMARY KEY, mime TEXT NOT NULL, body BLOB NOT NULL);
        CREATE TABLE recipe(title TEXT);
        CREATE TABLE items(id INTEGER PRIMARY KEY, name TEXT NOT NULL, note TEXT);
        INSERT INTO slop_meta VALUES('format','slop/2'),('document_id','checked'),('title','Checked'),('revision','0');
        INSERT INTO slop_view VALUES('/','text/html','\(escaped)');
        INSERT INTO recipe VALUES('Pasta');
        INSERT INTO items(name, note) VALUES ('Guanciale', NULL), ('Eggs', 'room temp');
        \(extraSQL)
        """
        guard sqlite3_exec(handle, sql, nil, nil, nil) == SQLITE_OK else {
            throw SlopError.sqlite(String(cString: sqlite3_errmsg(handle)))
        }
        return package
    }
}
