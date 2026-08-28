import ElementaryUI
import Reactivity
import SlopKit

@SlopModel
struct Todo: Equatable {
    var id: Int
    var title: String
    var done: Bool
    var position: Int
}

@Reactive
final class SQLiteTodoStore {
    var todos: [Todo] = []
    var isLoading = true
    var errorMessage = ""
    var lastChangeSource = "package"
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
            #sql("SELECT id, title, done, position FROM todos ORDER BY position, id"),
            as: Todo.self
        ) { result in
            switch result {
            case .success(let todos):
                self.todos = todos
                self.isLoading = false
                self.errorMessage = ""
                self.lastChangeSource = source
            case .failure(let error):
                self.fail(error.message)
            }
        }
    }

    func add(title: String) {
        let nextPosition = (todos.map { todo in todo.position }.max() ?? -1) + 1
        execute(#sql("INSERT INTO todos (title, done, position) VALUES (\(title), 0, \(nextPosition))"))
    }

    func toggle(_ todo: Todo) {
        execute(#sql("UPDATE todos SET done = \(!todo.done) WHERE id = \(todo.id)"))
    }

    func rename(_ todo: Todo, title: String) {
        execute(#sql("UPDATE todos SET title = \(title) WHERE id = \(todo.id)"))
    }

    func delete(_ todo: Todo) {
        execute(#sql("DELETE FROM todos WHERE id = \(todo.id)"))
    }

    private func execute(_ statement: SlopStatement) {
        database.execute(statement) { result in
            switch result {
            case .success:
                self.reload(source: "app")
            case .failure(let error):
                self.fail(error.message)
            }
        }
    }

    private func fail(_ message: String) {
        errorMessage = message
        isLoading = false
    }
}

@View
struct ContentView {
    @State var store = SQLiteTodoStore()
    @State var draft = ""
    @State var editingID: Int?
    @State var editingTitle = ""
    @FocusState var editingFocused: Bool

    var completedCount: Int { store.todos.filter { todo in todo.done }.count }

    var body: some View {
        main {
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
