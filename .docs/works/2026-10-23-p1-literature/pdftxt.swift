import Foundation
import PDFKit

// pdftxt <file.pdf> [firstPage] [lastPage]: prints NFKC text, one "=== page N" marker per page.
let args = CommandLine.arguments
guard args.count >= 2, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
    FileHandle.standardError.write("pdftxt: cannot open PDF\n".data(using: .utf8)!)
    exit(1)
}
let count = doc.pageCount
let first = args.count >= 3 ? max(1, Int(args[2]) ?? 1) : 1
let last = args.count >= 4 ? min(count, Int(args[3]) ?? count) : count
if count == 0 || first > last { exit(2) }
for i in first...last {
    let text = doc.page(at: i - 1)?.string ?? ""
    print("=== page \(i)")
    print(text.precomposedStringWithCompatibilityMapping)  // NFKC: "ﬁ" becomes "fi"
}
