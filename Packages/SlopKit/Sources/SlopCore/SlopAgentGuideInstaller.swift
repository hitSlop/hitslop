import Foundation

public enum SlopAgentGuideInstaller {
    public static func install(into packageURL: URL) throws {
        let package = try SlopPackage(rootURL: packageURL)
        guard let templateURL = Bundle.module.resourceURL?.appendingPathComponent("AgentSkill/SKILL.md"),
              var skill = try? String(contentsOf: templateURL, encoding: .utf8)
        else {
            throw SlopHostError.invalidPackage("Bundled coding-agent skill is missing")
        }

        let stores = package.manifest.stores.map { store in
            switch store.kind {
            case .json:
                return "- `\(store.id)` is JSON at `\(store.path)`; replace it atomically."
            case .sqlite:
                return "- `\(store.id)` is SQLite at `\(store.path)`; inspect or update it with `sqlite3`."
            }
        }.joined(separator: "\n")
        skill = skill
            .replacingOccurrences(of: "{{TITLE}}", with: package.manifest.title)
            .replacingOccurrences(of: "{{STORE_GUIDE}}", with: stores)

        let agentGuide = """
        # \(package.manifest.title)

        Read `manifest.json` first. Follow `.agents/skills/hitslop/SKILL.md` for this package.

        - This is a runtime document, not a source project. Do not add `source/`, package manifests, or dependencies.
        - Edit `style.css` for live visual overrides and edit only declared stores.
        - Treat `build/index.html` as generated, read-only application code.
        """ + "\n"
        let claudeGuide = """
        # \(package.manifest.title)

        Load `.claude/skills/hitslop/SKILL.md` before editing this package. Read `manifest.json` first and obey its runtime-only file and store boundaries.
        """ + "\n"

        try write(agentGuide, to: packageURL.appendingPathComponent("AGENTS.md"))
        try write(claudeGuide, to: packageURL.appendingPathComponent("CLAUDE.md"))
        try write(skill, to: packageURL.appendingPathComponent(".agents/skills/hitslop/SKILL.md"))
        try write(skill, to: packageURL.appendingPathComponent(".claude/skills/hitslop/SKILL.md"))
    }

    private static func write(_ value: String, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data(value.utf8).write(to: url, options: .atomic)
    }
}
