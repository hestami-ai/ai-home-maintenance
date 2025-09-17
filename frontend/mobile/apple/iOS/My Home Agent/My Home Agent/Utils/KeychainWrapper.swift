import Foundation
import Security

class KeychainWrapper {
    static let standard = KeychainWrapper()
    private init() {}
    
    // MARK: - Public Methods
    
    func set(_ value: String, forKey key: String) -> Bool {
        if let data = value.data(using: .utf8) {
            return set(data, forKey: key)
        }
        return false
    }
    
    func set(_ value: Data, forKey key: String) -> Bool {
        let query = keychainQuery(withKey: key)
        
        var status: OSStatus = SecItemCopyMatching(query as CFDictionary, nil)
        
        if status == errSecSuccess {
            // Item exists, update it
            let attributes: [String: Any] = [kSecValueData as String: value]
            status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
            return status == errSecSuccess
        } else if status == errSecItemNotFound {
            // Item doesn't exist, add it
            var query = keychainQuery(withKey: key)
            query[kSecValueData as String] = value
            status = SecItemAdd(query as CFDictionary, nil)
            return status == errSecSuccess
        }
        
        return false
    }
    
    func string(forKey key: String) -> String? {
        if let data = data(forKey: key) {
            return String(data: data, encoding: .utf8)
        }
        return nil
    }
    
    func data(forKey key: String) -> Data? {
        let query = keychainQuery(withKey: key)
        var dataTypeRef: AnyObject?
        
        let status: OSStatus = withUnsafeMutablePointer(to: &dataTypeRef) {
            SecItemCopyMatching(query as CFDictionary, UnsafeMutablePointer($0))
        }
        
        if status == errSecSuccess {
            return dataTypeRef as? Data
        }
        
        return nil
    }
    
    func removeObject(forKey key: String) -> Bool {
        let query = keychainQuery(withKey: key)
        let status: OSStatus = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess
    }
    
    func removeAllItems() -> Bool {
        let secItemClasses = [
            kSecClassGenericPassword,
            kSecClassInternetPassword,
            kSecClassCertificate,
            kSecClassKey,
            kSecClassIdentity
        ]
        
        for secItemClass in secItemClasses {
            let query: [String: Any] = [kSecClass as String: secItemClass]
            let status: OSStatus = SecItemDelete(query as CFDictionary)
            if status != errSecSuccess && status != errSecItemNotFound {
                return false
            }
        }
        
        return true
    }
    
    // MARK: - Private Methods
    
    private func keychainQuery(withKey key: String) -> [String: Any] {
        let bundleId = Bundle.main.bundleIdentifier ?? "com.hestami.app"
        
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: bundleId,
            kSecAttrAccount as String: key,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecReturnData as String: kCFBooleanTrue!
        ]
    }
}
