import Foundation
import Testing
@testable import HitSlopCore

@Test func rejectsTraversal() { #expect(!SlopPackage.isSafeRelativePath("../data.json")); #expect(SlopPackage.isSafeRelativePath("stores/data.json")) }
@Test func hashIsStable() { #expect(SlopArchive.sha256(of: Data("hello".utf8)) == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824") }
