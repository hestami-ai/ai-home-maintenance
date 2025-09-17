import Foundation
import SwiftUI

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
            print("✅ Test passed! Successfully parsed LoginResponse")
            print("User: \(response.user.firstName) \(response.user.lastName)")
            print("Email: \(response.user.email)")
            print("Role: \(response.user.userRole)")
            print("Display Name: \(response.user.displayName)")
            print("Initials: \(response.user.initials)")
        } catch {
            // Print any errors
            print("❌ Test failed with error: \(error)")
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