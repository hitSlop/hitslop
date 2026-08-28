import ElementaryUI
import JavaScriptKit
import Reactivity

// JavaScript can call storage completions after the view value that started
// them has been reconciled away. Keep bridge closures alive for the lifetime
// of the WASM instance so callbacks never jump through a released Swift thunk.
private var slopBridgeClosures: [JSClosure] = []

@Reactive
private final class SlopDocumentInvalidation {
    var version = 0
}

public final class SlopJSONDocument<Value: SlopJSONCodable> {
    public var value: Value {
        get { observe(); return storedValue }
        set { storedValue = newValue; invalidate() }
    }
    public var isLoading: Bool {
        get { observe(); return storedIsLoading }
        set { storedIsLoading = newValue; invalidate() }
    }
    public var errorMessage: String {
        get { observe(); return storedErrorMessage }
        set { storedErrorMessage = newValue; invalidate() }
    }
    public var lastChangeSource: String {
        get { observe(); return storedLastChangeSource }
        set { storedLastChangeSource = newValue; invalidate() }
    }
    public private(set) var revision: String? {
        get { observe(); return storedRevision }
        set { storedRevision = newValue; invalidate() }
    }
    public var onValueChange: ((Value, String) -> Void)?

    private let observation = SlopDocumentInvalidation()
    private var storedValue: Value
    private var storedIsLoading = true
    private var storedErrorMessage = ""
    private var storedLastChangeSource = "package"
    private var storedRevision: String?
    private let storeID: String
    private var retainedClosures: [JSClosure] = []
    private var started = false

    public init(storeID: String, default defaultValue: Value) {
        self.storeID = storeID
        self.storedValue = defaultValue
    }

    public func start() {
        guard !started else { return }
        started = true
        reload()
        let observer = JSClosure { arguments in
            self.lastChangeSource = arguments.first?.object?["source"].string ?? "external"
            self.reload()
            return .undefined
        }
        retainedClosures.append(observer)
        slopBridgeClosures.append(observer)
        _ = JSObject.global.__slopJSONOnChange.function?(storeID, observer)
    }

    public func reload() {
        isLoading = true
        let callback = JSOneshotClosure { arguments in
            if let error = arguments.first?.string {
                self.errorMessage = error
                self.isLoading = false
                self.onValueChange?(self.value, self.lastChangeSource)
                return .undefined
            }
            if arguments.count >= 3, let json = SlopJSONValue(arguments[1]), let value = Value(json: json) {
                self.value = value
                self.revision = arguments[2].string
                self.errorMessage = ""
            } else {
                self.errorMessage = "Could not decode the JSON document"
            }
            self.isLoading = false
            self.onValueChange?(self.value, self.lastChangeSource)
            return .undefined
        }
        _ = JSObject.global.__slopJSONRead.function?(storeID, callback)
    }

    public func update(_ operation: (inout Value) -> Void) {
        var candidate = value
        operation(&candidate)
        let callback = JSOneshotClosure { arguments in
            if let error = arguments.first?.string {
                self.errorMessage = error
                self.reload()
            } else {
                self.value = candidate
                self.revision = arguments.count > 1 ? arguments[1].string : self.revision
                self.lastChangeSource = "app"
                self.errorMessage = ""
                self.onValueChange?(self.value, self.lastChangeSource)
            }
            return .undefined
        }
        _ = JSObject.global.__slopJSONWrite.function?(storeID, candidate.json.jsValue, revision?.jsValue ?? .null, callback)
    }

    private func observe() {
        _ = observation.version
    }

    private func invalidate() {
        observation.version += 1
    }
}

public final class SlopSQLite {
    public let storeID: String
    private var retainedClosures: [JSClosure] = []

    public init(storeID: String) { self.storeID = storeID }

    public func query(
        _ sql: String,
        parameters: [SlopJSONValue] = [],
        completion: @escaping ([[String: SlopJSONValue]]?, String?) -> Void
    ) {
        let callback = JSOneshotClosure { arguments in
            if let error = arguments.first?.string { completion(nil, error); return .undefined }
            guard arguments.count > 1, let rows = arguments[1].object else {
                completion(nil, "Unreadable SQLite rows"); return .undefined
            }
            let count = Int(rows.length.number ?? 0)
            let values = (0..<count).compactMap { SlopJSONValue(rows[$0])?.objectValue }
            values.count == count ? completion(values, nil) : completion(nil, "Could not decode SQLite rows")
            return .undefined
        }
        let array = JSObject.global.Array.function!().object!
        for value in parameters { _ = array.push!(value.jsValue) }
        _ = JSObject.global.__slopQuery.function?(storeID, sql, array, callback)
    }

    public func query<Model: SlopJSONCodable>(
        _ statement: SlopStatement,
        as type: Model.Type,
        completion: @escaping (Result<[Model], SlopError>) -> Void
    ) {
        query(statement.sql, parameters: statement.parameters) { rows, error in
            if let error {
                completion(.failure(SlopError(error)))
                return
            }
            guard let rows else {
                completion(.failure(SlopError("Could not read SQLite rows")))
                return
            }
            let values = rows.compactMap { Model(json: .object($0)) }
            guard values.count == rows.count else {
                completion(.failure(SlopError("Could not decode SQLite rows as \(Model.self)")))
                return
            }
            completion(.success(values))
        }
    }

    public func execute(
        _ sql: String,
        parameters: [SlopJSONValue] = [],
        completion: @escaping (Int?, String?) -> Void
    ) {
        let callback = JSOneshotClosure { arguments in
            if let error = arguments.first?.string { completion(nil, error); return .undefined }
            completion(Int(arguments.count > 1 ? arguments[1].number ?? 0 : 0), nil)
            return .undefined
        }
        let array = JSObject.global.Array.function!().object!
        for value in parameters { _ = array.push!(value.jsValue) }
        _ = JSObject.global.__slopExecute.function?(storeID, sql, array, callback)
    }

    public func execute(
        _ statement: SlopStatement,
        completion: @escaping (Result<Int, SlopError>) -> Void
    ) {
        execute(statement.sql, parameters: statement.parameters) { changes, error in
            if let error {
                completion(.failure(SlopError(error)))
            } else {
                completion(.success(changes ?? 0))
            }
        }
    }

    public func transaction(
        _ statements: [(sql: String, parameters: [SlopJSONValue])],
        completion: @escaping (Int?, String?) -> Void
    ) {
        let callback = JSOneshotClosure { arguments in
            if let error = arguments.first?.string { completion(nil, error); return .undefined }
            completion(Int(arguments.count > 1 ? arguments[1].number ?? 0 : 0), nil)
            return .undefined
        }
        let items = JSObject.global.Array.function!().object!
        for statement in statements {
            let object = JSObject.global.Object.function!().object!
            object["sql"] = statement.sql.jsValue
            let parameters = JSObject.global.Array.function!().object!
            for value in statement.parameters { _ = parameters.push!(value.jsValue) }
            object["parameters"] = .object(parameters)
            _ = items.push!(object)
        }
        _ = JSObject.global.__slopTransaction.function?(storeID, items, callback)
    }

    public func transaction(
        _ statements: [SlopStatement],
        completion: @escaping (Result<Int, SlopError>) -> Void
    ) {
        transaction(statements.map { ($0.sql, $0.parameters) }) { changes, error in
            if let error {
                completion(.failure(SlopError(error)))
            } else {
                completion(.success(changes ?? 0))
            }
        }
    }

    public func onChange(_ handler: @escaping (String) -> Void) {
        let callback = JSClosure { arguments in
            handler(arguments.first?.object?["source"].string ?? "external")
            return .undefined
        }
        retainedClosures.append(callback)
        slopBridgeClosures.append(callback)
        _ = JSObject.global.__slopSQLiteOnChange.function?(storeID, callback)
    }
}
