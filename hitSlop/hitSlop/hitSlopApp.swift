//
//  hitSlopApp.swift
//  hitSlop
//
//  Created by Jordan Howlett on 8/26/26.
//

import SwiftUI

@main
struct hitSlopApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        Settings {
            Text("hitSlop documents save every change directly to SQLite.")
                .frame(width: 360)
                .padding(24)
        }
    }
}
