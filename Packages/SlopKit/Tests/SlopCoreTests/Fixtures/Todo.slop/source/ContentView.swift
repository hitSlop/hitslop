import ElementaryFlow
import ElementaryUI
import SlopKit

struct Todo: Equatable {
    var id: Int
    var title: String
    var done: Bool
    var position: Int
}

struct TodoData: SlopJSONCodable, Equatable {
    var title: String
    var subtitle: String
    var todos: [Todo]
    var nextID: Int

    init(title: String, subtitle: String, todos: [Todo], nextID: Int) {
        self.title = title
        self.subtitle = subtitle
        self.todos = todos
        self.nextID = nextID
    }

    init?(json: SlopJSONValue) {
        guard let object = json.objectValue,
              let title = object.required("title")?.stringValue,
              let subtitle = object.required("subtitle")?.stringValue,
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
        self.title = title
        self.subtitle = subtitle
        self.nextID = nextID
        self.todos = todos
    }

    var json: SlopJSONValue {
        .object([
            "title": .string(title),
            "subtitle": .string(subtitle),
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
        default: TodoData(
            title: "Field notes",
            subtitle: "A tiny Swift app whose memory lives beside it.",
            todos: [],
            nextID: 1
        )
    )
    @State var draft = ""
    @State var editingID: Int?
    @State var editingTitle = ""
    @State var editingHeaderTitle = false
    @State var editingHeaderSubtitle = false
    @State var headerTitleDraft = ""
    @State var headerSubtitleDraft = ""
    @State var viewVersion = 0
    @FocusState var editingFocused: Bool
    @FocusState var headerFocused: Bool

    var completedCount: Int { store.value.todos.filter { todo in todo.done }.count }

    var body: some View {
        main(.class("notes-shell"), .data("revision", value: "\(viewVersion)")) {
            header(.class("notes-header")) {
                if editingHeaderTitle {
                    input(
                        .class("title-editor"),
                        .type(.text),
                        .custom(name: "autofocus", value: ""),
                        .data("slop-inline-editor", value: "true"),
                        .custom(name: "aria-label", value: "Document title")
                    )
                    .bindValue($headerTitleDraft)
                    .onKeyDown { event in
                        if event.key == "Enter" { saveHeaderTitle() }
                        else if event.key == "Escape" { cancelHeaderEditing() }
                    }
                } else {
                    h1(
                        .class("note-title"),
                        .role("button"),
                        .custom(name: "tabindex", value: "0"),
                        .custom(name: "aria-label", value: "Edit document title")
                    ) { store.value.title }
                    .onClick { beginEditingHeaderTitle() }
                    .onKeyDown { event in
                        if event.key == "Enter" || event.key == " " { beginEditingHeaderTitle() }
                    }
                    .style(
                        .fontFamily("var(--slop-font-heading)"),
                        .fontSize("var(--note-title-size)"),
                        .color("var(--slop-text)"),
                        .cursor(.text)
                    )
                    .style(when: .hover, .color("var(--slop-accent)"))
                }

                if editingHeaderSubtitle {
                    input(
                        .class("subtitle-editor"),
                        .type(.text),
                        .custom(name: "autofocus", value: ""),
                        .data("slop-inline-editor", value: "true"),
                        .custom(name: "aria-label", value: "Document subtitle")
                    )
                    .bindValue($headerSubtitleDraft)
                    .onKeyDown { event in
                        if event.key == "Enter" { saveHeaderSubtitle() }
                        else if event.key == "Escape" { cancelHeaderEditing() }
                    }
                } else {
                    p(
                        .class("note-subtitle"),
                        .role("button"),
                        .custom(name: "tabindex", value: "0"),
                        .custom(name: "aria-label", value: "Edit document subtitle")
                    ) { store.value.subtitle.isEmpty ? "Add a subtitle…" : store.value.subtitle }
                    .onClick { beginEditingHeaderSubtitle() }
                    .onKeyDown { event in
                        if event.key == "Enter" || event.key == " " { beginEditingHeaderSubtitle() }
                    }
                    .style(.color("var(--slop-text-muted)"), .cursor(.text))
                    .style(when: .hover, .color("var(--slop-accent)"))
                }
            }
            .style(.margin(b: "var(--note-section-gap)"))

            div(.id("composer"), .class("composer")) {
                input(
                    .class("composer-input"),
                    .type(.text),
                    .custom(name: "aria-label", value: "New note"),
                    .placeholder("Write the next small thing…")
                )
                .bindValue($draft)
                .onKeyDown { event in
                    if event.key == "Enter" { addNote() }
                }
                button(.class("primary-action")) { "Add note" }
                    .onClick { addNote() }
                    .style(
                        .background("var(--slop-accent)"),
                        .color("var(--slop-accent-contrast)"),
                        .borderRadius("var(--slop-radius-pill)"),
                        .cursor(.pointer),
                        .transition("background var(--slop-duration-fast) ease-out")
                    )
                    .style(when: .active, .opacity(0.78))
            }
            .style(
                .display(.flex),
                .alignItems(.end),
                .gap("var(--slop-space-3)"),
                .margin(b: "var(--slop-space-5)")
            )

            ul(.class("notes-list")) {
                ForEach(store.value.todos, key: { String($0.id) }) { todo in
                    li(
                        .class("note-row"),
                        .data("done", value: todo.done ? "true" : "false"),
                        .data("editing", value: editingID == todo.id ? "true" : "false")
                    ) {
                        button(
                            .class("complete-action"),
                            .custom(name: "aria-label", value: todo.done ? "Mark incomplete" : "Mark complete")
                        ) { "✓" }
                        .onClick { toggle(todo) }

                        if editingID == todo.id {
                            input(
                                .class("note-editor"),
                                .type(.text),
                                .custom(name: "autofocus", value: ""),
                                .data("slop-inline-editor", value: "true"),
                                .custom(name: "aria-label", value: "Edit \(todo.title)")
                            )
                            .bindValue($editingTitle)
                            .onKeyDown { event in
                                if event.key == "Enter" { save(todo) }
                                else if event.key == "Escape" { cancelNoteEditing() }
                            }
                        } else {
                            span(
                                .class("note-copy"),
                                .role("button"),
                                .custom(name: "tabindex", value: "0"),
                                .custom(name: "aria-label", value: "Edit \(todo.title)")
                            ) { todo.title }
                            .onClick { beginEditing(todo) }
                            .onKeyDown { event in
                                if event.key == "Enter" || event.key == " " { beginEditing(todo) }
                            }
                            button(.class("delete-note"), .custom(name: "aria-label", value: "Delete \(todo.title)")) { "×" }
                                .onClick { store.update { $0.todos.removeAll(where: { $0.id == todo.id }) } }
                        }
                    }
                }
            }

            if !store.errorMessage.isEmpty {
                p(.id("error"), .class("document-error")) { store.errorMessage }
            } else {
                p(.id("status"), .class("document-status")) {
                    store.isLoading
                        ? "Reading the package…"
                        : "\(store.value.todos.count) notes · \(completedCount) finished · last change: \(store.lastChangeSource)"
                }
            }
            footer(.class("document-footer")) { "data.json · atomic, local, and AI-editable" }
        }
        .style(
            .minHeight("100vh"),
            .padding(
                t: "var(--note-page-top)",
                r: "var(--note-page-right)",
                b: "var(--note-page-bottom)",
                l: "var(--note-page-left)"
            )
        )
        .onAppear {
            store.onValueChange = { (_: TodoData, _: String) in viewVersion += 1 }
            store.start()
        }
    }

    private func addNote() {
        guard !draft.isEmpty, !draft.allSatisfy({ $0.isWhitespace }) else { return }
        let title = draft
        store.update { data in
            data.todos.append(Todo(id: data.nextID, title: title, done: false, position: data.todos.count))
            data.nextID += 1
        }
        draft = ""
    }

    private func toggle(_ todo: Todo) {
        store.update { data in
            guard let index = data.todos.firstIndex(where: { $0.id == todo.id }) else { return }
            data.todos[index].done.toggle()
        }
    }

    private func beginEditing(_ todo: Todo) {
        saveEditingHeader()
        saveEditingNote()
        editingID = todo.id
        editingTitle = todo.title
    }

    private func save(_ todo: Todo) {
        guard !editingTitle.isEmpty, !editingTitle.allSatisfy({ $0.isWhitespace }) else {
            stopEditing()
            return
        }
        let title = editingTitle
        store.update { data in
            guard let index = data.todos.firstIndex(where: { $0.id == todo.id }) else { return }
            data.todos[index].title = title
        }
        stopEditing()
    }

    private func saveEditingNote() {
        guard let editingID,
              let todo = store.value.todos.first(where: { $0.id == editingID }) else { return }
        save(todo)
    }

    private func stopEditing() {
        editingID = nil
    }

    private func cancelNoteEditing() {
        stopEditing()
    }

    private func beginEditingHeaderTitle() {
        saveEditingNote()
        saveEditingHeader()
        editingHeaderTitle = true
        headerTitleDraft = store.value.title
    }

    private func beginEditingHeaderSubtitle() {
        saveEditingNote()
        saveEditingHeader()
        editingHeaderSubtitle = true
        headerSubtitleDraft = store.value.subtitle
    }

    private func saveHeaderTitle() {
        guard editingHeaderTitle else { return }
        guard !headerTitleDraft.isEmpty, !headerTitleDraft.allSatisfy({ $0.isWhitespace }) else {
            stopHeaderEditing()
            return
        }
        let title = headerTitleDraft
        store.update { $0.title = title }
        stopHeaderEditing()
    }

    private func saveHeaderSubtitle() {
        guard editingHeaderSubtitle else { return }
        let subtitle = headerSubtitleDraft
        store.update { $0.subtitle = subtitle }
        stopHeaderEditing()
    }

    private func saveEditingHeader() {
        if editingHeaderTitle { saveHeaderTitle() }
        else if editingHeaderSubtitle { saveHeaderSubtitle() }
    }

    private func stopHeaderEditing() {
        editingHeaderTitle = false
        editingHeaderSubtitle = false
    }

    private func cancelHeaderEditing() {
        stopHeaderEditing()
    }
}
