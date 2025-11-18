import SwiftUI

/// A view that renders markdown text with proper formatting
struct MarkdownText: View {
    let markdown: String
    let textColor: Color
    let font: Font
    
    init(_ markdown: String, textColor: Color = .primary, font: Font = .body) {
        self.markdown = markdown
        self.textColor = textColor
        self.font = font
    }
    
    var body: some View {
        if let attributedString = try? AttributedString(markdown: markdown, options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)) {
            Text(attributedString)
                .font(font)
                .foregroundColor(textColor)
                .textSelection(.enabled)
        } else {
            // Fallback to plain text if markdown parsing fails
            Text(markdown)
                .font(font)
                .foregroundColor(textColor)
                .textSelection(.enabled)
        }
    }
}

struct MarkdownText_Previews: PreviewProvider {
    static var previews: some View {
        VStack(alignment: .leading, spacing: 20) {
            MarkdownText("# Heading 1")
            MarkdownText("**Bold text** and *italic text*")
            MarkdownText("- Item 1\n- Item 2\n- Item 3")
            MarkdownText("`code` and normal text")
        }
        .padding()
        .preferredColorScheme(.dark)
    }
}
