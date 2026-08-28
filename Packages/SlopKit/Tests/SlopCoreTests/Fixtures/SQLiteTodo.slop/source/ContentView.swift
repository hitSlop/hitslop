import ElementaryUI
import SlopKit

struct Todo: Equatable {
    var id: Int
    var title: String
    var done: Bool
    var position: Int
}

final class SQLiteTodoStore {
    var todos: [Todo] = []
    var isLoading = true
    var errorMessage = ""
    var lastChangeSource = "package"
    var onValueChange: (() -> Void)?

    private let database = SlopSQLite(storeID: "main")
    private var started = false

    func start() {
        guard !started else { return }
        started = true
        reload(source: "package")
        database.onChange { source in
            self.reload(source: source)
        }
    }

    func reload(source: String) {
        isLoading = true
        database.query(
            "SELECT id, title, done, position FROM todos ORDER BY position, id"
        ) { rows, error in
            guard let rows else {
                self.fail(error ?? "Could not read SQLite")
                return
            }

            let todos = rows.compactMap { row -> Todo? in
                guard let id = row["id"]?.intValue,
                      let title = row["title"]?.stringValue,
                      let done = row["done"]?.intValue,
                      let position = row["position"]?.intValue else { return nil }
                return Todo(id: id, title: title, done: done != 0, position: position)
            }
            guard todos.count == rows.count else {
                self.fail("Could not decode SQLite rows")
                return
            }

            self.todos = todos
            self.isLoading = false
            self.errorMessage = ""
            self.lastChangeSource = source
            self.onValueChange?()
        }
    }

    func add(title: String) {
        let nextPosition = (todos.map { todo in todo.position }.max() ?? -1) + 1
        execute(
            "INSERT INTO todos (title, done, position) VALUES (?, 0, ?)",
            parameters: [.string(title), .number(Double(nextPosition))]
        )
    }

    func toggle(_ todo: Todo) {
        execute(
            "UPDATE todos SET done = ? WHERE id = ?",
            parameters: [.number(todo.done ? 0 : 1), .number(Double(todo.id))]
        )
    }

    func rename(_ todo: Todo, title: String) {
        execute(
            "UPDATE todos SET title = ? WHERE id = ?",
            parameters: [.string(title), .number(Double(todo.id))]
        )
    }

    func delete(_ todo: Todo) {
        execute(
            "DELETE FROM todos WHERE id = ?",
            parameters: [.number(Double(todo.id))]
        )
    }

    private func execute(_ sql: String, parameters: [SlopJSONValue]) {
        database.execute(sql, parameters: parameters) { _, error in
            if let error {
                self.fail(error)
            } else {
                self.reload(source: "app")
            }
        }
    }

    private func fail(_ message: String) {
        errorMessage = message
        isLoading = false
        onValueChange?()
    }
}

@View
struct ContentView {
    @State var store = SQLiteTodoStore()
    @State var draft = ""
    @State var editingID: Int?
    @State var editingTitle = ""
    @State var viewVersion = 0
    @FocusState var editingFocused: Bool

    var completedCount: Int { store.todos.filter { todo in todo.done }.count }

    var body: some View {
        main(.data("revision", value: "\(viewVersion)")) {
            header {
                h1 { "SQLite notes" }
                p { "A tiny Swift app with a relational memory beside it." }
            }
            div(.id("composer")) {
                input(.type(.text), .placeholder("Write the next small thing…")).bindValue($draft)
                button { "Add note" }.onClick {
                    let title = draft
                    guard !title.isEmpty else { return }
                    store.add(title: title)
                    draft = ""
                }
            }
            ul {
                ForEach(store.todos, key: { String($0.id) }) { todo in
                    li(
                        .data("done", value: todo.done ? "true" : "false"),
                        .data("editing", value: editingID == todo.id ? "true" : "false")
                    ) {
                        button(.custom(name: "aria-label", value: todo.done ? "Mark incomplete" : "Mark complete")) { "✓" }
                            .onClick { store.toggle(todo) }
                        if editingID == todo.id {
                            input(.type(.text), .custom(name: "aria-label", value: "Edit \(todo.title)"))
                                .bindValue($editingTitle)
                                .focused($editingFocused)
                                .onKeyDown { event in
                                    if event.key == "Enter" { save(todo) }
                                    else if event.key == "Escape" { stopEditing() }
                                }
                            button(.custom(name: "aria-label", value: "Save \(todo.title)")) { "Save" }
                                .onClick { save(todo) }
                        } else {
                            span(.role("button"), .custom(name: "tabindex", value: "0"), .custom(name: "aria-label", value: "Edit \(todo.title)")) { todo.title }
                                .onClick {
                                    editingID = todo.id
                                    editingTitle = todo.title
                                    editingFocused = true
                                }
                            button(.custom(name: "aria-label", value: "Delete \(todo.title)")) { "×" }
                                .onClick { store.delete(todo) }
                        }
                    }
                }
            }
            if !store.errorMessage.isEmpty {
                p(.id("error")) { store.errorMessage }
            } else {
                p(.id("status")) {
                    store.isLoading
                        ? "Reading SQLite…"
                        : "\(store.todos.count) notes · \(completedCount) finished · last change: \(store.lastChangeSource)"
                }
            }
            footer { "data.sqlite · transactional, local, and AI-readable" }
        }
        .onAppear {
            store.onValueChange = { viewVersion += 1 }
            store.start()
        }
    }

    private func save(_ todo: Todo) {
        let title = editingTitle
        guard !title.isEmpty else { return }
        store.rename(todo, title: title)
        stopEditing()
    }

    private func stopEditing() {
        editingID = nil
        editingFocused = false
    }
}
