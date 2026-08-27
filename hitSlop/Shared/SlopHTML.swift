import Foundation
import justhtml

enum SlopHTML {
    static func parseDocument(_ source: String, trusted: Bool = false) throws -> Node {
        let parsed = try JustHTML(source, limits: trusted ? .unlimited : .default)
        return parsed.root
    }

    static func parseTemplate(_ source: String, trusted: Bool = false) throws -> Node {
        let wrapped = "<!doctype html><html><head></head><body><template>\(source)</template></body></html>"
        let document = try parseDocument(wrapped, trusted: trusted)
        guard let template = try query(document, "template").first,
              let content = template.templateContent else {
            throw SlopError.invalidArgument("Could not parse row template")
        }
        return content.cloneNode(deep: true)
    }

    static func parseFragment(_ source: String, context: String) throws -> Node {
        try JustHTML(source, fragmentContext: FragmentContext(context)).root
    }

    static func serialize(_ root: Node) -> String {
        root.toHTML(pretty: false)
    }

    static func htmlElement(in document: Node) -> Node? {
        document.children.first { $0.name == "html" }
    }

    static func query(_ node: Node, _ selector: String) throws -> [Node] {
        try node.query(selector)
    }

    /// CSS query that does not descend into `<template>` contents.
    static func queryVisible(_ node: Node, _ selector: String) throws -> [Node] {
        var results: [Node] = []
        try collectVisible(node, selector: selector, into: &results, includeSelf: true)
        return results
    }

    private static func collectVisible(_ node: Node, selector: String, into results: inout [Node], includeSelf: Bool) throws {
        if includeSelf, try matches(node, selector) {
            results.append(node)
        }
        for child in node.children {
            try collectVisible(child, selector: selector, into: &results, includeSelf: true)
        }
    }

    static func matches(_ node: Node, _ selector: String) throws -> Bool {
        try justhtml.matches(node, selector: selector)
    }

    static func closest(_ node: Node?, _ selector: String) throws -> Node? {
        var current = node
        while let node = current {
            if try matches(node, selector) { return node }
            current = node.parent
        }
        return nil
    }

    static func directChildren(_ node: Node, named name: String) -> [Node] {
        node.children.filter { $0.name == name }
    }

    static func textContent(_ node: Node) -> String {
        if node.name == "#text" { return node.text }
        if node.name == "script" || node.name == "style" {
            return node.children.map(textContent).joined()
        }
        if node.name == "template", let content = node.templateContent {
            return textContent(content)
        }
        return node.children.map(textContent).joined()
    }

    static func setText(_ node: Node, _ value: String) {
        node.data = .text(value)
    }

    static func removeAllChildren(_ node: Node) {
        for child in node.children {
            node.removeChild(child)
        }
    }

    static func insertMoving(_ fragment: Node, before reference: Node) {
        guard let parent = reference.parent else { return }
        for child in fragment.children {
            fragment.removeChild(child)
            parent.insertBefore(child, reference: reference)
        }
    }

    static func walk(_ node: Node, visitTemplateContent: Bool = true, _ visit: (Node) throws -> Void) rethrows {
        try visit(node)
        if visitTemplateContent, let content = node.templateContent {
            try walk(content, visitTemplateContent: visitTemplateContent, visit)
        }
        for child in node.children {
            try walk(child, visitTemplateContent: visitTemplateContent, visit)
        }
    }
}
