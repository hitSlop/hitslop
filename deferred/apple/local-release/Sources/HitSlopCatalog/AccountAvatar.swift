import HitSlopFeatures
import SwiftUI

struct AccountAvatar: View {
    let user: AccountUser?
    var size: CGFloat = 30

    var body: some View {
        AsyncImage(url: user?.photoURL) { phase in
            if let image = phase.image {
                image.resizable().scaledToFill()
            } else {
                Image(systemName: user == nil ? "person.crop.circle" : "person.crop.circle.fill")
                    .resizable().scaledToFit()
                    .padding(size * 0.2)
                    .foregroundStyle(.secondary)
            }
        }
        .id(user?.photoURL)
        .id(user?.id)
        .frame(width: size, height: size)
        .background(Color.primary.opacity(0.055), in: Circle())
        .clipShape(Circle())
        .accessibilityHidden(true)
    }
}
