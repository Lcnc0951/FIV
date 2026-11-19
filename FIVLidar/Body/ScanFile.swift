import Foundation

/// Filformatet FIV-appen importerer (Kropp → Skann → «Importer skann»).
/// Nettappen leser `measurements` med samme feltnavn som `ScanMeasurements`.
struct FIVScanFile: Codable {
    var format = "fiv-scan"
    var version = 1
    var app = "FIV LiDAR"
    var date: Date
    var weightKg: Double?
    var measurements: ScanMeasurements

    func encoded() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(self)
    }

    /// Lagrer skannet i en ny mappe sammen med bildene. Returnerer URL til JSON-filen.
    static func save(_ m: ScanMeasurements, weightKg: Double?, front: Data?, side: Data?) throws -> URL {
        let date = Date()
        let folder = try CaptureStore.makeFolder(.body, date: date)
        let day = date.formatted(.iso8601.year().month().day())
        let url = folder.appendingPathComponent("FIV-skann \(day).json")
        try FIVScanFile(date: date, weightKg: weightKg, measurements: m).encoded().write(to: url)
        if let front { try front.write(to: folder.appendingPathComponent("forfra.jpg")) }
        if let side { try side.write(to: folder.appendingPathComponent("fra-siden.jpg")) }
        return url
    }
}

