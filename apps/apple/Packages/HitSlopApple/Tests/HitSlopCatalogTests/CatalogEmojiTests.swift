import Testing
@testable import HitSlopCatalog

@Test func sidebarFiltersUseFunEmojisInsteadOfSymbols() {
    #expect(catalogFilterEmoji(.all) == "🧃")
    #expect(catalogFilterEmoji(.recents) == "🔥")
    #expect(catalogFilterEmoji(.myTemplates) == "🏡")
}

@Test func categoryEmojisCoverTheCatalogSidebar() {
    #expect(categoryEmoji("productivity") == "⚡️")
    #expect(categoryEmoji("utilities") == "🪄")
    #expect(categoryEmoji("finance") == "🤑")
    #expect(categoryEmoji("media") == "🎬")
    #expect(categoryEmoji("games") == "🎮")
    #expect(categoryEmoji("developer-tools") == "👾")
    #expect(categoryEmoji("education") == "🎓")
    #expect(categoryEmoji("business") == "📊")
    #expect(categoryEmoji("personal") == "💖")
    #expect(categoryEmoji("other") == "🎲")
    #expect(categoryEmoji("unknown") == "🎲")
}
