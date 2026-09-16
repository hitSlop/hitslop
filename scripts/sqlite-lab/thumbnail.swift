import AppKit
import QuickLookThumbnailing

// Exercise the system thumbnail extension, without a Finder custom icon.
guard CommandLine.arguments.count == 3 else { fatalError("thumbnail.swift input.slopsql output.png") }
let request = QLThumbnailGenerator.Request(fileAt: URL(fileURLWithPath: CommandLine.arguments[1]), size: CGSize(width: 512, height: 512), scale: 1, representationTypes: .thumbnail)
let destination = URL(fileURLWithPath: CommandLine.arguments[2])
QLThumbnailGenerator.shared.generateBestRepresentation(for: request) { representation, error in
    guard let representation else { fputs("\(String(describing: error))\n", stderr); exit(1) }
    do {
        let bitmap = NSBitmapImageRep(cgImage: representation.cgImage)
        try bitmap.representation(using: .png, properties: [:])!.write(to: destination)
        print("type=\(representation.type.rawValue), \(bitmap.pixelsWide)x\(bitmap.pixelsHigh)")
        exit(0)
    } catch { fputs("\(error)\n", stderr); exit(1) }
}
DispatchQueue.global().asyncAfter(deadline: .now() + 30) { fputs("Thumbnail timed out\n", stderr); exit(2) }
dispatchMain()
