import AVFoundation

/// Taleveiledning på norsk — du står 3 meter unna skjermen under skanning og økter.
final class VoiceCoach {
    static let shared = VoiceCoach()

    private let synthesizer = AVSpeechSynthesizer()
    private var lastSpoken = Date.distantPast
    var isEnabled = true

    private init() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.duckOthers, .mixWithOthers])
    }

    func speak(_ text: String, interrupt: Bool = false) {
        DispatchQueue.main.async { [self] in
            guard isEnabled else { return }
            // Ikke mas: maks én ny beskjed hvert 2,5 sekund med mindre det er viktig.
            if !interrupt && (synthesizer.isSpeaking || Date().timeIntervalSince(lastSpoken) < 2.5) { return }
            if interrupt { synthesizer.stopSpeaking(at: .immediate) }
            try? AVAudioSession.sharedInstance().setActive(true)
            let utterance = AVSpeechUtterance(string: text)
            utterance.voice = AVSpeechSynthesisVoice(language: "nb-NO")
            utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 1.02
            synthesizer.speak(utterance)
            lastSpoken = Date()
        }
    }
}
