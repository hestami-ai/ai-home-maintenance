# Password Management API Documentation

## Overview

All password management operations must go through the SvelteKit proxy endpoints. Direct access to Django API endpoints is not available for web or mobile clients.

**Base URL:** `https://homeservices.hestami-ai.com` (production) or `http://localhost:5173` (development)

---

## Endpoints

### 1. Change Password (Authenticated)

Change the password for an authenticated user.

**Endpoint:** `POST /api/users/password/change`  
**Authentication:** Required (Cookie-based session)  
**Content-Type:** `application/json`

#### Request Body

```json
{
  "old_password": "currentPassword123",
  "new_password": "newSecurePassword456",
  "confirm_password": "newSecurePassword456"
}
```

#### Success Response (200 OK)

```json
{
  "message": "Password changed successfully",
  "success": true
}
```

#### Error Responses

**400 Bad Request** - Validation error
```json
{
  "error": "Old password and new password are required"
}
```

**401 Unauthorized** - Not authenticated
```json
{
  "error": "Authentication required"
}
```

**403 Forbidden** - Incorrect old password
```json
{
  "old_password": "Incorrect password"
}
```

---

### 2. Request Password Reset (Public)

Request a password reset email. Does not require authentication.

**Endpoint:** `POST /api/users/password/reset`  
**Authentication:** Not required (Public)  
**Content-Type:** `application/json`

#### Request Body

```json
{
  "email": "user@example.com"
}
```

#### Success Response (200 OK)

```json
{
  "message": "Password reset email sent. Please check your inbox.",
  "success": true
}
```

#### Error Responses

**400 Bad Request** - Invalid email
```json
{
  "error": "Email is required"
}
```

**404 Not Found** - Email not found (may return 200 for security)
```json
{
  "message": "If an account exists with this email, a reset link has been sent.",
  "success": true
}
```

---

### 3. Confirm Password Reset (Public)

Complete the password reset process using the token from email.

**Endpoint:** `POST /api/users/password/reset/confirm`  
**Authentication:** Not required (Public)  
**Content-Type:** `application/json`

#### Request Body

```json
{
  "token": "reset-token-from-email",
  "new_password": "newSecurePassword789",
  "confirm_password": "newSecurePassword789"
}
```

#### Success Response (200 OK)

```json
{
  "message": "Password has been reset successfully",
  "success": true
}
```

#### Error Responses

**400 Bad Request** - Validation error
```json
{
  "error": "Token and new password are required"
}
```

**400 Bad Request** - Invalid or expired token
```json
{
  "token": "Invalid or expired reset token"
}
```

**400 Bad Request** - Weak password
```json
{
  "new_password": "Password must be at least 8 characters"
}
```

---

## iOS Integration

### Swift Example - Change Password

```swift
import Foundation

struct PasswordChangeRequest: Codable {
    let old_password: String
    let new_password: String
    let confirm_password: String?
}

struct PasswordChangeResponse: Codable {
    let message: String
    let success: Bool
}

class PasswordService {
    static let baseURL = "https://homeservices.hestami-ai.com"
    
    static func changePassword(
        oldPassword: String,
        newPassword: String,
        confirmPassword: String,
        completion: @escaping (Result<PasswordChangeResponse, Error>) -> Void
    ) {
        guard let url = URL(string: "\(baseURL)/api/users/password/change") else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1)))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Include cookies for authentication
        request.httpShouldHandleCookies = true
        
        let body = PasswordChangeRequest(
            old_password: oldPassword,
            new_password: newPassword,
            confirm_password: confirmPassword
        )
        
        do {
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            completion(.failure(error))
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "No data", code: -1)))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(NSError(domain: "Invalid response", code: -1)))
                return
            }
            
            if httpResponse.statusCode == 200 {
                do {
                    let result = try JSONDecoder().decode(PasswordChangeResponse.self, from: data)
                    completion(.success(result))
                } catch {
                    completion(.failure(error))
                }
            } else {
                // Handle error response
                if let errorDict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let errorMessage = errorDict["error"] as? String {
                    completion(.failure(NSError(domain: errorMessage, code: httpResponse.statusCode)))
                } else {
                    completion(.failure(NSError(domain: "Request failed", code: httpResponse.statusCode)))
                }
            }
        }.resume()
    }
}
```

### Swift Example - Request Password Reset

```swift
struct PasswordResetRequest: Codable {
    let email: String
}

struct PasswordResetResponse: Codable {
    let message: String
    let success: Bool
}

extension PasswordService {
    static func requestPasswordReset(
        email: String,
        completion: @escaping (Result<PasswordResetResponse, Error>) -> Void
    ) {
        guard let url = URL(string: "\(baseURL)/api/users/password/reset") else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1)))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = PasswordResetRequest(email: email.lowercased().trimmingCharacters(in: .whitespaces))
        
        do {
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            completion(.failure(error))
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data,
                  let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(NSError(domain: "Invalid response", code: -1)))
                return
            }
            
            if httpResponse.statusCode == 200 {
                do {
                    let result = try JSONDecoder().decode(PasswordResetResponse.self, from: data)
                    completion(.success(result))
                } catch {
                    completion(.failure(error))
                }
            } else {
                if let errorDict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let errorMessage = errorDict["error"] as? String {
                    completion(.failure(NSError(domain: errorMessage, code: httpResponse.statusCode)))
                } else {
                    completion(.failure(NSError(domain: "Request failed", code: httpResponse.statusCode)))
                }
            }
        }.resume()
    }
}
```

### Swift Example - Confirm Password Reset

```swift
struct PasswordResetConfirmRequest: Codable {
    let token: String
    let new_password: String
    let confirm_password: String?
}

struct PasswordResetConfirmResponse: Codable {
    let message: String
    let success: Bool
}

extension PasswordService {
    static func confirmPasswordReset(
        token: String,
        newPassword: String,
        confirmPassword: String,
        completion: @escaping (Result<PasswordResetConfirmResponse, Error>) -> Void
    ) {
        guard let url = URL(string: "\(baseURL)/api/users/password/reset/confirm") else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1)))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = PasswordResetConfirmRequest(
            token: token,
            new_password: newPassword,
            confirm_password: confirmPassword
        )
        
        do {
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            completion(.failure(error))
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data,
                  let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(NSError(domain: "Invalid response", code: -1)))
                return
            }
            
            if httpResponse.statusCode == 200 {
                do {
                    let result = try JSONDecoder().decode(PasswordResetConfirmResponse.self, from: data)
                    completion(.success(result))
                } catch {
                    completion(.failure(error))
                }
            } else {
                if let errorDict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let errorMessage = errorDict["error"] as? String {
                    completion(.failure(NSError(domain: errorMessage, code: httpResponse.statusCode)))
                } else {
                    completion(.failure(NSError(domain: "Request failed", code: httpResponse.statusCode)))
                }
            }
        }.resume()
    }
}
```

---

## Password Validation Rules

### Minimum Requirements
- **Length:** At least 8 characters
- **Complexity:** Mix of uppercase, lowercase, numbers, and special characters recommended

### Strength Scoring (0-5)
- **0-1:** Weak (red)
- **2-3:** Fair (yellow)
- **4:** Good (blue)
- **5:** Strong (green)

### Validation Criteria
1. ✅ Length >= 8 characters (+1 point)
2. ✅ Length >= 12 characters (+1 point)
3. ✅ Contains both uppercase and lowercase (+1 point)
4. ✅ Contains at least one number (+1 point)
5. ✅ Contains at least one special character (+1 point)

---

## Error Handling Best Practices

### For iOS Apps

1. **Network Errors:** Show user-friendly message and retry option
2. **Validation Errors:** Display specific field errors inline
3. **Authentication Errors:** Redirect to login
4. **Token Expiration:** Show message and link to request new reset email

### Example Error Handling

```swift
func handlePasswordError(_ error: Error) {
    let nsError = error as NSError
    
    switch nsError.code {
    case 400:
        // Validation error - show specific message
        showAlert(title: "Invalid Input", message: nsError.domain)
    case 401:
        // Not authenticated - redirect to login
        navigateToLogin()
    case 403:
        // Incorrect password
        showAlert(title: "Incorrect Password", message: "Please check your current password")
    case 500:
        // Server error - retry
        showAlert(title: "Server Error", message: "Please try again later")
    default:
        // Generic error
        showAlert(title: "Error", message: "An unexpected error occurred")
    }
}
```

---

## Testing

### Test Accounts (Development Only)

Use these for testing password management flows:

- Email: `test@example.com`
- Password: `TestPassword123!`

### Test Scenarios

1. ✅ Change password with correct old password
2. ✅ Change password with incorrect old password (should fail)
3. ✅ Change password with weak new password (should show warning)
4. ✅ Request password reset for existing email
5. ✅ Request password reset for non-existent email (should still return success for security)
6. ✅ Confirm password reset with valid token
7. ✅ Confirm password reset with expired token (should fail)
8. ✅ Confirm password reset with invalid token (should fail)

---

## Security Considerations

1. **All requests go through SvelteKit proxy** - No direct Django API access
2. **Cookie-based authentication** - Cookies are httpOnly and secure
3. **CORS protection** - Enforced by SvelteKit
4. **Rate limiting** - Implemented on Django backend
5. **Token expiration** - Reset tokens expire after 24 hours
6. **Password hashing** - Using bcrypt/argon2 on backend
7. **HTTPS only** - All production traffic must use HTTPS

---

## Support

For issues or questions:
- Backend: Check Django logs in `/var/log/django/`
- Frontend: Check browser console and SvelteKit server logs
- iOS: Check Xcode console for network errors
