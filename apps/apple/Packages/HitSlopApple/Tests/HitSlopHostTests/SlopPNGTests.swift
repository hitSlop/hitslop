import AppKit
import Foundation
import Testing
import zlib

@testable import HitSlopHost

struct SlopPNGTests {
    @Test func nativeSoftEdgeCaptureShrinksWithoutChangingPixels() throws {
        let bitmap = try #require(NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 480, pixelsHigh: 620,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
            colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0))
        let pixels = try #require(bitmap.bitmapData)
        for y in 0..<620 {
            for x in 0..<480 {
                let shade = UInt8(24 * exp(-pow(Double(x - 220) / 90, 2)))
                let i = y * bitmap.bytesPerRow + x * 4
                pixels[i] = 245 - shade; pixels[i + 1] = 210 - shade
                pixels[i + 2] = 220 - shade; pixels[i + 3] = 255
            }
        }
        let original = try #require(bitmap.representation(using: .png, properties: [:]))
        let optimized = SlopPNG.optimize(original)
        #expect(optimized.count < original.count * 3 / 4)
        #expect(optimized[25] == 2)
        try expectSameImage(original, optimized)
        #expect(metadata(original) == metadata(optimized))
    }

    @Test(arguments: [2, 6]) func allFiltersAndAlphaSamplesRoundTrip(color: Int) throws {
        let channels = color == 6 ? 4 : 3, width = 31, height = 25
        var pixels = [UInt8](repeating: 0, count: width * height * channels)
        for i in pixels.indices { pixels[i] = UInt8(truncatingIfNeeded: i * 37 + i / 17) }
        if channels == 4 {
            for i in stride(from: 3, to: pixels.count, by: 4) {
                pixels[i] = [0, 1, 127, 254, 255][(i / 4) % 5]
            }
        }
        let original = makePNG(width: width, height: height, color: color, pixels: pixels, cycleFilters: true)
        let optimized = SlopPNG.optimize(original)
        #expect(optimized.count <= original.count)
        #expect(optimized[25] == UInt8(color))
        try expectSameImage(original, optimized)
        #expect(metadata(original) == metadata(optimized))
    }

    @Test func transparentPixelsAndColorDependentMetadataRetainRGBA() throws {
        for alpha: UInt8 in [0, 127, 255] {
            let pixel: [UInt8] = [71, 122, 193, alpha]
            let pixels = Array(repeating: pixel, count: 64 * 64).flatMap { $0 }
            let original = makePNG(width: 64, height: 64, color: 6, pixels: pixels,
                extra: chunk("sBIT", [8, 8, 8, 8]))
            let optimized = SlopPNG.optimize(original)
            #expect(optimized.count <= original.count)
            #expect(optimized[25] == 6)
            #expect(metadata(original) == metadata(optimized))
            try expectSameImage(original, optimized)
        }
    }

    @Test func invalidOrUnsupportedPNGsAreReturnedUnchanged() {
        let valid = makePNG(width: 2, height: 2, color: 6, pixels: Array(repeating: 255, count: 16))
        var badCRC = valid; badCRC[29] ^= 1
        var unsupportedDepth = [UInt8](valid[16..<29]); unsupportedDepth[8] = 16
        var interlaced = [UInt8](valid[16..<29]); interlaced[12] = 1
        var tooWide = [UInt8](valid[16..<29]); tooWide.replaceSubrange(0..<4, with: [0, 1, 0, 0])
        var huge = [UInt8](valid[16..<29]); huge.replaceSubrange(0..<8, with: [0, 0, 64, 0, 0, 0, 64, 0])
        var invalidInputs: [Data] = [Data(), Data("not png".utf8), Data(valid.prefix(20)), Data(valid.dropLast()), badCRC]
        invalidInputs.append(valid + Data([0]))
        for header in [unsupportedDepth, interlaced, tooWide, huge] {
            var changed = Data(valid.prefix(8))
            changed.append(chunk("IHDR", header))
            changed.append(valid.dropFirst(33))
            invalidInputs.append(changed)
        }
        invalidInputs.append(makePNG(width: 2, height: 2, color: 6, pixels: Array(repeating: 255, count: 16),
                                     extra: chunk("acTL", [0, 0, 0, 1, 0, 0, 0, 0])))
        invalidInputs.append(makePNG(width: 2, height: 2, color: 6, pixels: Array(repeating: 255, count: 16), badFilter: true))
        for invalid in invalidInputs {
            #expect(SlopPNG.optimize(invalid) == invalid)
        }
    }

    @Test func cancelledOptimizationDoesNotReturnAnExport() async {
        let task = Task {
            withUnsafeCurrentTask { $0?.cancel() }
            return try await SlopPNG.optimized(Data())
        }
        await #expect(throws: CancellationError.self) { try await task.value }
    }

    private func expectSameImage(_ first: Data, _ second: Data) throws {
        let a = try #require(NSBitmapImageRep(data: first)), b = try #require(NSBitmapImageRep(data: second))
        #expect(a.pixelsWide == b.pixelsWide && a.pixelsHigh == b.pixelsHigh)
        // Normalize storage layout only; getPixel returns unpremultiplied encoded components.
        // AppKit imports the sample pointer as Int or UInt depending on the SDK.
        // Infer it from getPixel so both SDKs exercise the same component comparison.
        func compare<Sample: FixedWidthInteger>(
            _ readLeft: (UnsafeMutablePointer<Sample>, Int, Int) -> Void,
            _ readRight: (UnsafeMutablePointer<Sample>, Int, Int) -> Void
        ) {
            var left = [Sample](repeating: 0, count: 4), right = left
            for y in 0..<a.pixelsHigh {
                for x in 0..<a.pixelsWide {
                    left[3] = 255; right[3] = 255
                    readLeft(&left, x, y); readRight(&right, x, y)
                    if left != right { Issue.record("Pixels differ at \(x),\(y): \(left) != \(right)"); return }
                }
            }
        }
        compare(a.getPixel, b.getPixel)
    }

    private func makePNG(width: Int, height: Int, color: Int, pixels: [UInt8],
                         cycleFilters: Bool = false, extra: Data = Data(), badFilter: Bool = false) -> Data {
        let channels = color == 6 ? 4 : 3, stride = width * channels
        var rows = [UInt8]()
        for y in 0..<height {
            let filter = cycleFilters ? y % 5 : 0
            rows.append(badFilter ? 5 : UInt8(filter))
            for x in 0..<stride {
                let i = y * stride + x
                let a = x >= channels ? Int(pixels[i - channels]) : 0
                let b = y > 0 ? Int(pixels[i - stride]) : 0
                let c = y > 0 && x >= channels ? Int(pixels[i - stride - channels]) : 0
                let p = a + b - c, distances = [abs(p - a), abs(p - b), abs(p - c)]
                let paeth = [a, b, c][distances.firstIndex(of: distances.min()!)!]
                rows.append(pixels[i] &- UInt8([0, a, b, (a + b) / 2, paeth][filter]))
            }
        }
        var length = compressBound(uLong(rows.count)), compressed = [UInt8](repeating: 0, count: Int(compressBound(uLong(rows.count))))
        let status = compress2(&compressed, &length, rows, uLong(rows.count), Z_BEST_SPEED)
        #expect(status == Z_OK)
        var header = Data(); append32(UInt32(width), to: &header); append32(UInt32(height), to: &header)
        header.append(contentsOf: [8, UInt8(color), 0, 0, 0])
        return Data([137, 80, 78, 71, 13, 10, 26, 10]) + chunk("IHDR", Array(header))
            + chunk("sRGB", [0]) + chunk("tEXt", Array("Capture\0pixel equality".utf8)) + extra
            + chunk("IDAT", Array(compressed.prefix(Int(length)))) + chunk("IEND", [])
    }

    private func chunk(_ type: String, _ payload: [UInt8]) -> Data {
        var result = Data(); append32(UInt32(payload.count), to: &result)
        let content = Array(type.utf8) + payload
        result.append(contentsOf: content)
        append32(UInt32(crc32(0, content, uInt(content.count))), to: &result)
        return result
    }

    private func append32(_ value: UInt32, to data: inout Data) {
        var bigEndian = value.bigEndian
        withUnsafeBytes(of: &bigEndian) { data.append(contentsOf: $0) }
    }

    private func metadata(_ data: Data) -> [Data] {
        let bytes = [UInt8](data)
        var result: [Data] = [], offset = 8
        while offset + 12 <= bytes.count {
            let length = bytes[offset..<(offset + 4)].reduce(0) { $0 << 8 | Int($1) }
            let type = String(bytes: bytes[(offset + 4)..<(offset + 8)], encoding: .ascii)
            if type != "IHDR" && type != "IDAT" { result.append(Data(bytes[offset..<(offset + length + 12)])) }
            offset += length + 12
        }
        return result
    }
}
