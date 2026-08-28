# SlopGuest

`SlopGuest` is the WASM-side SDK imported by editable `.slop` apps as `SlopKit`. It deliberately adds persistence ergonomics without wrapping or limiting ElementaryUI.

```swift
import ElementaryUI
import SlopKit

@SlopModel
struct Todo {
    var id: Int
    var title: String
    var done: Bool
}

let id = 42
let statement = #sql("SELECT id, title, done FROM todos WHERE id = \(id)")
database.query(statement, as: Todo.self) { result in
    // Result<[Todo], SlopError>
}
```

`@SlopModel` generates the JSON row/document codec and memberwise initializer. `#sql` replaces every interpolation with a `?` placeholder and puts the encoded values in `SlopStatement.parameters`; interpolated values never become SQL text.

Raw `SlopJSONValue` and string-based SQLite methods remain available for dynamic data and advanced SQL.
