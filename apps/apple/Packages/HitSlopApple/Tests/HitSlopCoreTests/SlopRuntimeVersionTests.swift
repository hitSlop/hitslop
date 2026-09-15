import HitSlopCore
import Testing

@Test func selectsCompatibleRuntimeNumerically() throws {
    #expect(try SlopRuntimeVersion.select(required: "1.2.0", available: ["2.0.0", "1.3.1", "1.12.0", "1.1.0"]) == "1.12.0")
    #expect(try SlopRuntimeVersion.select(required: "1.2.0", available: ["1.2.0"]) == "1.2.0")
    #expect(throws: SlopRuntimeCompatibilityError(required: "1.2.0", available: ["1.1.0", "2.0.0"])) {
        try SlopRuntimeVersion.select(required: "1.2.0", available: ["1.1.0", "2.0.0"])
    }
    #expect(throws: SlopRuntimeCompatibilityError(required: "99.0.0", available: [])) {
        try SlopRuntimeVersion.select(required: "99.0.0", available: [])
    }
}
@Test func malformedRuntimeVersionsAreRejected() {
    for version in ["1", "1.2", "0.1.0", "01.0.0", "1.0.0-beta", "^1.0.0", "1.9999999999.0", "1.0.0\n"] {
        #expect(throws: (any Error).self) { try SlopRuntimeVersion(version) }
    }
}
