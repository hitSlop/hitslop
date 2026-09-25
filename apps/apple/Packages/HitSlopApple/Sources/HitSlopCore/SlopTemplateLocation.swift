import Foundation

/// Shared catalog-master classification. Opening a master must never create live document state.
public enum SlopTemplateLocation {
  public static var defaultTemplatesRoot: URL {
    FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".hitslop/templates", isDirectory: true)
  }

  public static func isManagedTemplatePackage(_ url: URL, templatesRoot: URL = defaultTemplatesRoot) -> Bool {
    let candidate = url.standardizedFileURL.resolvingSymlinksInPath().pathComponents
    var roots = [templatesRoot]
    if let resources = Bundle.main.resourceURL {
      roots.append(resources.appendingPathComponent("StarterTemplates"))
    }
    // The installed CLI's main bundle is Contents/Helpers, not the enclosing app.
    if let executable = Bundle.main.executableURL?.resolvingSymlinksInPath() {
      let helpers = executable.deletingLastPathComponent()
      let contents = helpers.deletingLastPathComponent()
      if helpers.lastPathComponent.caseInsensitiveCompare("Helpers") == .orderedSame,
         contents.lastPathComponent.caseInsensitiveCompare("Contents") == .orderedSame,
         contents.deletingLastPathComponent().pathExtension.caseInsensitiveCompare("app") == .orderedSame {
        roots.append(contents.appendingPathComponent("Resources/StarterTemplates"))
      }
    }
    return roots.contains { url in
      let root = url.standardizedFileURL.resolvingSymlinksInPath().pathComponents
      return candidate.count > root.count && zip(root, candidate).allSatisfy {
        $0.caseInsensitiveCompare($1) == .orderedSame
      }
    }
  }
}
