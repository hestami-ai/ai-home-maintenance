// Dark mode background colors
extension UIColor {
    // Primary background (equivalent to bg-surface-900)
    static let darkBackground = UIColor(red: 0.11, green: 0.11, blue: 0.12, alpha: 1.0)
    
    // Secondary background (equivalent to bg-surface-800)
    static let darkBackgroundSecondary = UIColor(red: 0.15, green: 0.15, blue: 0.17, alpha: 1.0)
    
    // Tertiary background (equivalent to bg-surface-700)
    static let darkBackgroundTertiary = UIColor(red: 0.20, green: 0.20, blue: 0.22, alpha: 1.0)
}

extension UIColor {
    // Primary text (equivalent to text-white)
    static let darkTextPrimary = UIColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0)
    
    // Secondary text (equivalent to text-surface-300)
    static let darkTextSecondary = UIColor(red: 0.7, green: 0.7, blue: 0.7, alpha: 1.0)
    
    // Disabled text (equivalent to text-surface-500)
    static let darkTextDisabled = UIColor(red: 0.5, green: 0.5, blue: 0.5, alpha: 1.0)
}

extension UIColor {
    // Primary accent (equivalent to primary-500)
    static let accentPrimary = UIColor(red: 0.0, green: 0.47, blue: 0.95, alpha: 1.0) // #0078F2
    
    // Secondary accent (equivalent to secondary-500)
    static let accentSecondary = UIColor(red: 0.95, green: 0.31, blue: 0.31, alpha: 1.0) // #F24F4F
    
    // Tertiary accent (equivalent to tertiary-500)
    static let accentTertiary = UIColor(red: 0.16, green: 0.71, blue: 0.47, alpha: 1.0) // #29B578
}

extension UIColor {
    // Success color
    static let success = UIColor(red: 0.16, green: 0.71, blue: 0.47, alpha: 1.0) // #29B578
    
    // Warning color
    static let warning = UIColor(red: 0.95, green: 0.69, blue: 0.16, alpha: 1.0) // #F2B029
    
    // Error color
    static let error = UIColor(red: 0.95, green: 0.31, blue: 0.31, alpha: 1.0) // #F24F4F
    
    // Info color
    static let info = UIColor(red: 0.0, green: 0.47, blue: 0.95, alpha: 1.0) // #0078F2
}


extension UIColor {
    static var dynamicBackground: UIColor {
        return UIColor { traitCollection in
            return traitCollection.userInterfaceStyle == .dark ? 
                UIColor(red: 0.11, green: 0.11, blue: 0.12, alpha: 1.0) : 
                UIColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1.0)
        }
    }
    
    static var dynamicText: UIColor {
        return UIColor { traitCollection in
            return traitCollection.userInterfaceStyle == .dark ? 
                UIColor.white : 
                UIColor(red: 0.13, green: 0.13, blue: 0.13, alpha: 1.0)
        }
    }
}

import SwiftUI

extension Color {
    static let darkBackground = Color(UIColor.darkBackground)
    static let darkBackgroundSecondary = Color(UIColor.darkBackgroundSecondary)
    static let accentPrimary = Color(UIColor.accentPrimary)
    // Add other colors as needed
}