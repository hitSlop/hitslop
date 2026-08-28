import ElementaryUI
import SlopKit

struct Todo: Equatable {
    var id: Int
    var title: String
    var done: Bool
    var position: Int
}

struct TodoData: SlopJSONCodable, Equatable {
    var todos: [Todo]
    var nextID: Int

    init(todos: [Todo], nextID: Int) {
        self.todos = todos
        self.nextID = nextID
    }

    init?(json: SlopJSONValue) {
        guard let object = json.objectValue,
              let nextID = object.required("nextID")?.intValue,
              let values = object.required("todos")?.arrayValue else { return nil }
        let todos = values.compactMap { value -> Todo? in
            guard let item = value.objectValue,
                  let id = item.required("id")?.intValue,
                  let title = item.required("title")?.stringValue,
                  let done = item.required("done")?.boolValue,
                  let position = item.required("position")?.intValue else { return nil }
            return Todo(id: id, title: title, done: done, position: position)
        }
        guard todos.count == values.count else { return nil }
        self.nextID = nextID
        self.todos = todos
    }

    var json: SlopJSONValue {
        .object([
            "nextID": .number(Double(nextID)),
            "todos": .array(todos.map { todo in
                .object([
                    "id": .number(Double(todo.id)),
                    "title": .string(todo.title),
                    "done": .bool(todo.done),
                    "position": .number(Double(todo.position)),
                ])
            }),
        ])
    }
}

@View
struct ContentView {
    @State var store = SlopJSONDocument(
        storeID: "state",
        default: TodoData(todos: [], nextID: 1)
    )
    @State var draft = ""
    @State var editingID: Int?
    @State var editingTitle = ""
    @State var viewVersion = 0
    @FocusState var editingFocused: Bool

    var completedCount: Int { store.value.todos.filter { todo in todo.done }.count }

    var body: some View {
        main(.data("revision", value: "\(viewVersion)")) {
            header {
                h1 { "Field notes" }
                p { "A tiny Swift app whose memory lives beside it." }
            }
            div(.id("composer")) {
                input(.type(.text), .placeholder("Write the next small thing…")).bindValue($draft)
                button { "Add note" }.onClick {
                    let title = draft
                    guard !title.isEmpty else { return }
                    store.update { data in
                        data.todos.append(Todo(id: data.nextID, title: title, done: false, position: data.todos.count))
                        data.nextID += 1
                    }
                    draft = ""
                }
            }
            ul {
                ForEach(store.value.todos, key: { String($0.id) }) { todo in
                    li(
                        .data("done", value: todo.done ? "true" : "false"),
                        .data("editing", value: editingID == todo.id ? "true" : "false")
                    ) {
                        button(.custom(name: "aria-label", value: todo.done ? "Mark incomplete" : "Mark complete")) { "✓" }
                            .onClick {
                                store.update { data in
                                    guard let index = data.todos.firstIndex(where: { $0.id == todo.id }) else { return }
                                    data.todos[index].done.toggle()
                                }
                            }
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
                                .onClick { store.update { $0.todos.removeAll(where: { $0.id == todo.id }) } }
                        }
                    }
                }
            }
            if !store.errorMessage.isEmpty {
                p(.id("error")) { store.errorMessage }
            } else {
                p(.id("status")) {
                    store.isLoading
                        ? "Reading the package…"
                        : "\(store.value.todos.count) notes · \(completedCount) finished · last change: \(store.lastChangeSource)"
                }
            }
            footer { "data.json · atomic, local, and AI-editable" }
        }
        .onAppear {
            store.onValueChange = { (_: TodoData, _: String) in viewVersion += 1 }
            store.start()
        }
    }

    private func save(_ todo: Todo) {
        let title = editingTitle
        guard !title.isEmpty else { return }
        store.update { data in
            guard let index = data.todos.firstIndex(where: { $0.id == todo.id }) else { return }
            data.todos[index].title = title
        }
        stopEditing()
    }

    private func stopEditing() {
        editingID = nil
        editingFocused = false
    }
}
