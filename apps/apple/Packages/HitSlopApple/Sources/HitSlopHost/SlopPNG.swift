import Foundation
import zlib

/// Lossless post-processing of native captures, without a color-space round trip.
/// Unsupported PNGs and unsuccessful optimizations retain the original bytes.
enum SlopPNG {
    private static let signature: [UInt8] = [137, 80, 78, 71, 13, 10, 26, 10]
    private static let ihdr: UInt32 = 0x49484452, idat: UInt32 = 0x49444154, iend: UInt32 = 0x49454e44

    static func optimized(_ data: Data) async throws -> Data {
        try Task.checkCancellation()
        let worker = Task.detached(priority: .userInitiated) { optimize(data) }
        let result = await withTaskCancellationHandler {
            await worker.value
        } onCancel: {
            worker.cancel()
        }
        try Task.checkCancellation()
        return result
    }

    private struct Chunk {
        let type: UInt32
        let payload: Range<Int>
        let encoded: Range<Int>
    }

    static func optimize(_ original: Data) -> Data {
        // Match native capture's pixel budget; also bound compressed input and chunk count.
        guard original.count <= 128 * 1024 * 1024, original.count >= 45,
              original.starts(with: signature), !Task.isCancelled else { return original }
        let bytes = [UInt8](original)
        var chunks: [Chunk] = [], compressed = [UInt8]()
        var offset = 8, ended = false, sawData = false, dataEnded = false
        // Color/physical/text metadata emitted by native encoders is copied verbatim.
        let metadata: Set<UInt32> = [
            0x73524742, 0x69434350, 0x67414d41, 0x6348524d, // sRGB, iCCP, gAMA, cHRM
            0x65584966, 0x70485973, 0x74455874, 0x7a545874, // eXIf, pHYs, tEXt, zTXt
            0x69545874, 0x74494d45, 0x73424954, 0x624b4744, // iTXt, tIME, sBIT, bKGD
            0x504c5445, 0x74524e53, // PLTE, tRNS
        ]
        while offset <= bytes.count - 12, !ended {
            guard chunks.count < 4096, !Task.isCancelled else { return original }
            let length = Int(read32(bytes, offset)), type = read32(bytes, offset + 4)
            guard length <= bytes.count - offset - 12 else { return original }
            let end = offset + 12 + length
            let validCRC = bytes.withUnsafeBufferPointer {
                crc32(0, $0.baseAddress! + offset + 4, uInt(length + 4)) == read32(bytes, end - 4)
            }
            guard validCRC, chunks.isEmpty ? type == ihdr : type != ihdr else { return original }
            switch type {
            case ihdr: guard length == 13 else { return original }
            case idat:
                guard !dataEnded else { return original }
                sawData = true
                compressed.append(contentsOf: bytes[(offset + 8)..<(end - 4)])
            case iend:
                guard length == 0, sawData, end == bytes.count else { return original }
                ended = true
            default:
                // Do not rewrite animation or unknown chunks whose semantics may depend on IDAT.
                guard metadata.contains(type) else { return original }
                if sawData { dataEnded = true }
            }
            chunks.append(Chunk(type: type, payload: (offset + 8)..<(end - 4), encoded: offset..<end))
            offset = end
        }
        guard ended, !compressed.isEmpty else { return original }
        let width = Int(read32(bytes, 16)), height = Int(read32(bytes, 20)), color = bytes[25]
        guard width > 0, height > 0, width <= 16_384, height <= 16_384,
              width * height <= 24_000_000, bytes[24] == 8, color == 2 || color == 6,
              bytes[26] == 0, bytes[27] == 0, bytes[28] == 0 else { return original }
        let channels = color == 6 ? 4 : 3, stride = width * channels
        var rows = [UInt8](repeating: 0, count: (stride + 1) * height)
        var decodedCount = uLongf(rows.count), sourceCount = uLong(compressed.count)
        let status = rows.withUnsafeMutableBufferPointer { output in
            compressed.withUnsafeBufferPointer { input in
                uncompress2(output.baseAddress!, &decodedCount, input.baseAddress!, &sourceCount)
            }
        }
        guard status == Z_OK, decodedCount == rows.count, sourceCount == compressed.count else { return original }

        var best = original
        func consider(_ payload: [UInt8], droppingAlpha: Bool = false) {
            guard !Task.isCancelled, let deflated = deflate(payload, limit: best.count) else { return }
            var output = Data(signature), wroteData = false
            for chunk in chunks {
                if chunk.type == idat {
                    if !wroteData { appendChunk(idat, deflated, to: &output); wroteData = true }
                } else if chunk.type == ihdr && droppingAlpha {
                    var header = Array(bytes[chunk.payload])
                    header[9] = 2
                    appendChunk(ihdr, header, to: &output)
                } else {
                    output.append(contentsOf: bytes[chunk.encoded])
                }
            }
            if output.count < best.count { best = output }
        }
        // Invalid filters must not be "repaired" by the optimization fallback.
        guard (0..<height).allSatisfy({ rows[$0 * (stride + 1)] <= 4 }) else { return original }
        consider(rows)
        let decoded = rows.withUnsafeMutableBufferPointer { buffer -> Bool in
            for y in 0..<height {
                if Task.isCancelled { return false }
                let row = y * (stride + 1), filter = buffer[row]
                for x in 0..<stride {
                    let i = row + 1 + x
                    let a = x >= channels ? buffer[i - channels] : 0
                    let b = y > 0 ? buffer[i - stride - 1] : 0
                    let c = y > 0 && x >= channels ? buffer[i - stride - 1 - channels] : 0
                    buffer[i] = buffer[i] &+ predictor(filter, a, b, c)
                }
            }
            return true
        }
        guard decoded else { return original }
        // sBIT has a color-type-dependent payload. Keep RGBA rather than alter metadata.
        let opaque = channels == 4 && !chunks.contains(where: { $0.type == 0x73424954 || $0.type == 0x74524e53 })
            && rows.withUnsafeBufferPointer { buffer in
                for y in 0..<height {
                    if Task.isCancelled { return false }
                    for x in 0..<width where buffer[y * (stride + 1) + 1 + x * 4 + 3] != 255 { return false }
                }
                return true
            }
        guard !Task.isCancelled else { return original }
        let outputChannels = opaque ? 3 : channels, outputStride = width * outputChannels
        var pixels = [UInt8](repeating: 0, count: height * outputStride)
        pixels.withUnsafeMutableBufferPointer { destination in
            rows.withUnsafeBufferPointer { source in
                for y in 0..<height {
                    if outputChannels == channels {
                        (destination.baseAddress! + y * outputStride).update(from: source.baseAddress! + y * (stride + 1) + 1, count: outputStride)
                        continue
                    }
                    for x in 0..<width {
                        for component in 0..<outputChannels {
                            destination[y * outputStride + x * outputChannels + component] = source[y * (stride + 1) + 1 + x * channels + component]
                        }
                    }
                }
            }
        }
        rows = []
        var filtered = [UInt8](repeating: 0, count: (outputStride + 1) * height)
        for y in 0..<height {
            filtered.replaceSubrange((y * (outputStride + 1) + 1)..<((y + 1) * (outputStride + 1)),
                                     with: pixels[(y * outputStride)..<((y + 1) * outputStride)])
        }
        consider(filtered, droppingAlpha: opaque)
        // Minimum sum of signed residual magnitudes, with deterministic filter tie-breaking.
        let completed = filtered.withUnsafeMutableBufferPointer { output -> Bool in
            pixels.withUnsafeBufferPointer { input in
                var candidate = [UInt8](repeating: 0, count: outputStride)
                return candidate.withUnsafeMutableBufferPointer { row in
                    for y in 0..<height {
                        if Task.isCancelled { return false }
                        var bestScore = Int.max
                        for filter: UInt8 in 0...4 {
                            var score = 0
                            for x in 0..<outputStride {
                                let i = y * outputStride + x
                                let a = x >= outputChannels ? input[i - outputChannels] : 0
                                let b = y > 0 ? input[i - outputStride] : 0
                                let c = y > 0 && x >= outputChannels ? input[i - outputStride - outputChannels] : 0
                                let value = input[i] &- predictor(filter, a, b, c)
                                row[x] = value
                                score += min(Int(value), 256 - Int(value))
                            }
                            if score < bestScore {
                                bestScore = score
                                output[y * (outputStride + 1)] = filter
                                (output.baseAddress! + y * (outputStride + 1) + 1).update(from: row.baseAddress!, count: outputStride)
                            }
                        }
                    }
                    return true
                }
            }
        }
        guard completed else { return original }
        consider(filtered, droppingAlpha: opaque)
        return best
    }

    private static func predictor(_ filter: UInt8, _ a: UInt8, _ b: UInt8, _ c: UInt8) -> UInt8 {
        switch filter {
        case 1: return a
        case 2: return b
        case 3: return UInt8((Int(a) + Int(b)) / 2)
        case 4:
            let p = Int(a) + Int(b) - Int(c)
            let pa = abs(p - Int(a)), pb = abs(p - Int(b)), pc = abs(p - Int(c))
            return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        default: return 0
        }
    }

    private static func deflate(_ bytes: [UInt8], limit: Int) -> [UInt8]? {
        // A larger candidate cannot win. Avoid reserving another full raster's worth of memory.
        var length = uLongf(min(limit, Int(compressBound(uLong(bytes.count)))))
        var output = [UInt8](repeating: 0, count: Int(length))
        let status = output.withUnsafeMutableBufferPointer { destination in
            bytes.withUnsafeBufferPointer { source in
                compress2(destination.baseAddress!, &length, source.baseAddress!, uLong(bytes.count), Z_BEST_COMPRESSION)
            }
        }
        guard status == Z_OK else { return nil }
        output.removeSubrange(Int(length)..<output.count)
        return output
    }

    private static func read32(_ bytes: [UInt8], _ offset: Int) -> UInt32 {
        UInt32(bytes[offset]) << 24 | UInt32(bytes[offset + 1]) << 16 | UInt32(bytes[offset + 2]) << 8 | UInt32(bytes[offset + 3])
    }

    private static func append32(_ value: UInt32, to data: inout Data) {
        var bigEndian = value.bigEndian
        withUnsafeBytes(of: &bigEndian) { data.append(contentsOf: $0) }
    }

    private static func appendChunk(_ type: UInt32, _ payload: [UInt8], to data: inout Data) {
        append32(UInt32(payload.count), to: &data)
        let start = data.count
        append32(type, to: &data)
        data.append(contentsOf: payload)
        let checksum = data.withUnsafeBytes {
            crc32(0, $0.bindMemory(to: UInt8.self).baseAddress! + start, uInt(payload.count + 4))
        }
        append32(UInt32(checksum), to: &data)
    }
}
