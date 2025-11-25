import Foundation
import SwiftUI
import OSLog

// Create a proper test class
class LoginResponseTests {
    // Simple test function to verify the LoginResponse parsing works
    static func testLoginResponseParsing() {
        // Sample JSON from the error message
        let jsonString = """
        {
            "success": true,
            "user": {
                "id": "3824fea0-90a9-4262-83c7-1c8d0d185ba4",
                "email": "mchendricks1@hotmail.com",
                "first_name": "Marshall",
                "last_name": "Hendricks",
                "user_role": "PROPERTY_OWNER"
            }
        }
        """
        
        // Create a JSON decoder with the same configuration as NetworkManager
        let jsonDecoder = JSONDecoder()
        jsonDecoder.keyDecodingStrategy = .convertFromSnakeCase
        
        do {
            // Try to decode the JSON
            let data = jsonString.data(using: .utf8)!
            let response = try jsonDecoder.decode(LoginResponse.self, from: data)
            
            // Print the result
            AppLogger.app.info("Test passed! Successfully parsed LoginResponse")
            AppLogger.app.debug("User: \(response.user.firstName, privacy: .public) \(response.user.lastName, privacy: .public)")
            AppLogger.app.debug("Email: \(response.user.email, privacy: .public)")
            AppLogger.app.debug("Role: \(response.user.userRole, privacy: .public)")
            AppLogger.app.debug("Display Name: \(response.user.displayName, privacy: .public)")
            AppLogger.app.debug("Initials: \(response.user.initials, privacy: .public)")
        } catch {
            // Print any errors
            AppLogger.error("Test failed", error: error, category: AppLogger.app)
        }
    }
}

// Create a simple SwiftUI view to run the test
struct LoginResponseTestView: View {
    var body: some View {
        VStack {
            Text("Login Response Test")
                .font(.title)
                .padding()
            
            Button("Run Test") {
                LoginResponseTests.testLoginResponseParsing()
            }
            .padding()
            .background(Color.blue)
            .foregroundColor(.white)
            .cornerRadius(8)
        }
        .padding()
    }
}

// Preview provider for SwiftUI canvas
struct LoginResponseTestView_Previews: PreviewProvider {
    static var previews: some View {
        LoginResponseTestView()
    }
}