import AVKit
import SwiftUI

// MARK: - Datamodell (leses fra ExerciseAnimations.json)

struct StickAnimation {
    enum ViewKind { case side, front }
    enum Anchor {
        case ground
        case hip(CGPoint)
        case hands(Double)
        case ankleL(CGPoint)
    }
    struct Prop {
        let type: String
        let v: [String: Double]
        subscript(_ key: String) -> Double { v[key] ?? 0 }
    }

    let view: ViewKind
    let anchor: Anchor
    let props: [Prop]
    let a: [String: Double]
    let b: [String: Double]
    let up: Double
    let down: Double
}

enum ExerciseAnimationStore {
    private static let loaded: (anims: [String: StickAnimation], map: [String: String]) = load()

    static func animation(for exerciseId: String) -> StickAnimation? {
        loaded.map[exerciseId].flatMap { loaded.anims[$0] }
    }

    /// Slår opp direkte på animasjonsnavn (brukes av holdningsøvelser).
    static func animation(named name: String) -> StickAnimation? {
        loaded.anims[name]
    }

    private static func load() -> ([String: StickAnimation], [String: String]) {
        guard let url = Bundle.main.url(forResource: "ExerciseAnimations", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let anims = root["animations"] as? [String: [String: Any]] else { return ([:], [:]) }
        let map = root["exercises"] as? [String: String] ?? [:]
        var result: [String: StickAnimation] = [:]
        for (name, raw) in anims {
            result[name] = parse(raw)
        }
        return (result, map)
    }

    private static func numbers(_ any: Any?) -> [String: Double] {
        guard let dict = any as? [String: Any] else { return [:] }
        return dict.compactMapValues { ($0 as? NSNumber)?.doubleValue }
    }

    private static func parse(_ raw: [String: Any]) -> StickAnimation {
        let front = (raw["view"] as? String) == "front"
        var defaults: [String: Double] = ["trunk": 0, "thighL": 0, "thighR": 0, "shinL": 0, "shinR": 0,
                                          "footL": 90, "footR": 90, "upperL": 0, "upperR": 0, "foreL": 0, "foreR": 0]
        if front { defaults.merge(["thighL": -4, "thighR": 4, "shinL": -2, "shinR": 2]) { $1 } }
        let base = merged(defaults, numbers(raw["base"]))
        let anchorDict = raw["anchor"] as? [String: Any] ?? [:]
        let an = numbers(anchorDict)
        let anchor: StickAnimation.Anchor = switch (anchorDict["type"] as? String) ?? "ground" {
        case "hip": .hip(CGPoint(x: an["x"] ?? 0, y: an["y"] ?? 0))
        case "hands": .hands(an["y"] ?? 2)
        case "ankleL": .ankleL(CGPoint(x: an["x"] ?? 0, y: an["y"] ?? 0))
        default: .ground
        }
        let props = (raw["props"] as? [[String: Any]] ?? []).map {
            StickAnimation.Prop(type: $0["type"] as? String ?? "", v: numbers($0))
        }
        let tempo = (raw["tempo"] as? [NSNumber])?.map(\.doubleValue) ?? [1.0, 2.0]
        return StickAnimation(view: front ? .front : .side, anchor: anchor, props: props,
                              a: merged(base, numbers(raw["a"])), b: merged(base, numbers(raw["b"])),
                              up: tempo.first ?? 1, down: tempo.count > 1 ? tempo[1] : 2)
    }

    /// "thigh" gjelder begge sider, "thighL" bare nærmeste.
    private static func merged(_ base: [String: Double], _ add: [String: Double]) -> [String: Double] {
        var p = base
        let shared = ["thigh", "shin", "foot", "upper", "fore"]
        for (k, v) in add where shared.contains(k) { p[k + "L"] = v; p[k + "R"] = v }
        for (k, v) in add where !shared.contains(k) { p[k] = v }
        return p
    }
}

// MARK: - Kinematikk

private enum Seg {
    static let trunk = 0.52, neck = 0.07, head = 0.1, thigh = 0.46, shin = 0.44, foot = 0.14, upper = 0.30, fore = 0.28
}

private func joints(_ anim: StickAnimation, _ p: [String: Double]) -> [String: CGPoint] {
    func rad(_ d: Double) -> Double { d * .pi / 180 }
    func limb(_ o: CGPoint, _ angle: Double, _ len: Double) -> CGPoint {
        CGPoint(x: o.x + len * sin(rad(angle)), y: o.y - len * cos(rad(angle)))
    }
    let front = anim.view == .front
    let t = rad(p["trunk"] ?? 0)
    let tv = CGPoint(x: sin(t), y: cos(t))
    let neck = CGPoint(x: tv.x * Seg.trunk, y: tv.y * Seg.trunk)
    var j: [String: CGPoint] = [
        "hip": .zero, "neck": neck,
        "head": CGPoint(x: neck.x + tv.x * (Seg.neck + Seg.head), y: neck.y + tv.y * (Seg.neck + Seg.head)),
    ]
    for (s, off) in [("L", -1.0), ("R", 1.0)] {
        let hip = CGPoint(x: front ? off * 0.1 : 0, y: 0)
        let sh = CGPoint(x: neck.x + (front ? off * 0.19 : 0), y: neck.y)
        let knee = limb(hip, p["thigh" + s] ?? 0, Seg.thigh)
        let ankle = limb(knee, p["shin" + s] ?? 0, Seg.shin)
        let toe = front ? CGPoint(x: ankle.x + off * 0.07, y: ankle.y) : limb(ankle, p["foot" + s] ?? 90, Seg.foot)
        let elbow = limb(sh, p["upper" + s] ?? 0, Seg.upper)
        let wrist = limb(elbow, p["fore" + s] ?? 0, Seg.fore)
        j["hip" + s] = hip; j["sh" + s] = sh; j["knee" + s] = knee; j["ankle" + s] = ankle
        j["toe" + s] = toe; j["elbow" + s] = elbow; j["wrist" + s] = wrist
    }
    var dx = 0.0, dy = 0.0
    switch anim.anchor {
    case .ground:
        var minY = j.filter { $0.key != "head" }.map { $0.value.y }.min() ?? 0
        minY = min(minY, (j["head"]?.y ?? 0) - Seg.head)
        dy = -minY
    case .hip(let pt):
        dx = pt.x; dy = pt.y
    case .hands(let y):
        let w = j["wristL"] ?? .zero
        dx = -w.x; dy = y - w.y
    case .ankleL(let pt):
        let a = j["ankleL"] ?? .zero
        dx = pt.x - a.x; dy = pt.y - a.y
    }
    return j.mapValues { CGPoint(x: $0.x + dx, y: $0.y + dy) }
}

private func interpolate(_ a: [String: Double], _ b: [String: Double], _ t: Double) -> [String: Double] {
    var r = a
    for (k, va) in a { r[k] = va + ((b[k] ?? va) - va) * t }
    return r
}

// MARK: - Visning

/// Animert figur som viser øvelsen. Musklene som trenes er markert i oransje.
struct StickFigureView: View {
    let animation: StickAnimation
    var highlight: Muscle? = nil
    var showsPhase = true

    private var bounds: CGRect {
        var pts = Array(joints(animation, animation.a).values) + Array(joints(animation, animation.b).values) + [.zero]
        for p in animation.props {
            for (x, y) in [("x1", "y"), ("x2", "y"), ("x", "y"), ("x1", "y1"), ("x2", "y2")] where p.v[x] != nil {
                pts.append(CGPoint(x: p[x], y: p.v[y] ?? 0))
            }
        }
        let xs = pts.map(\.x), ys = pts.map(\.y)
        return CGRect(x: (xs.min() ?? 0) - 0.25, y: (ys.min() ?? 0) - 0.1,
                      width: (xs.max() ?? 1) - (xs.min() ?? 0) + 0.5, height: (ys.max() ?? 1) - (ys.min() ?? 0) + 0.35)
    }

    var body: some View {
        TimelineView(.animation) { context in
            let (t, label) = phase(at: context.date)
            VStack(spacing: 6) {
                Canvas { ctx, size in draw(ctx, size: size, t: t) }
                if showsPhase {
                    Text(label).font(.caption.bold()).foregroundStyle(.secondary).contentTransition(.opacity)
                }
            }
        }
        .accessibilityLabel("Animasjon som viser hvordan øvelsen utføres")
    }

    /// Hold i strukket posisjon → løft → hold → senk kontrollert.
    private func phase(at date: Date) -> (Double, String) {
        let hold1 = 0.5, hold2 = 0.35
        let cycle = hold1 + animation.up + hold2 + animation.down
        let x = date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: cycle)
        func ease(_ v: Double) -> Double { v * v * (3 - 2 * v) }
        if x < hold1 { return (0, "Start") }
        if x < hold1 + animation.up { return (ease((x - hold1) / animation.up), String(format: "Løft · %.0f sek", animation.up)) }
        if x < hold1 + animation.up + hold2 { return (1, "Klem") }
        let d = (x - hold1 - animation.up - hold2) / animation.down
        return (1 - ease(d), String(format: "Senk kontrollert · %.0f sek", animation.down))
    }

    private func draw(_ ctx: GraphicsContext, size: CGSize, t: Double) {
        let box = bounds
        let scale = min(size.width / box.width, size.height / box.height)
        let ox = (size.width - box.width * scale) / 2, oy = (size.height - box.height * scale) / 2
        func P(_ p: CGPoint) -> CGPoint {
            CGPoint(x: ox + (p.x - box.minX) * scale, y: oy + (box.maxY - p.y) * scale)
        }
        let j = joints(animation, interpolate(animation.a, animation.b, t))
        let w = max(4, 0.065 * scale)

        func line(_ a: CGPoint, _ b: CGPoint, _ color: Color, width: CGFloat) {
            var path = Path(); path.move(to: P(a)); path.addLine(to: P(b))
            ctx.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: width, lineCap: .round))
        }

        // Gulv
        line(CGPoint(x: box.minX, y: 0), CGPoint(x: box.maxX, y: 0), .secondary.opacity(0.4), width: 1.5)

        // Utstyr
        let wristL = j["wristL"] ?? .zero, wristR = j["wristR"] ?? .zero
        for prop in animation.props {
            switch prop.type {
            case "bench", "seat", "box":
                let top = P(CGPoint(x: prop["x1"], y: prop["y"])), right = P(CGPoint(x: prop["x2"], y: 0))
                let rect = CGRect(x: top.x, y: top.y, width: right.x - top.x, height: prop.type == "seat" ? w * 0.8 : right.y - top.y)
                ctx.fill(Path(roundedRect: rect, cornerRadius: 3), with: .color(.gray.opacity(0.35)))
            case "line":
                line(CGPoint(x: prop["x1"], y: prop["y1"]), CGPoint(x: prop["x2"], y: prop["y2"]), .gray.opacity(0.45), width: w * 0.8)
            case "cable":
                line(wristL, CGPoint(x: prop["x"], y: prop["y"]), .green.opacity(0.7), width: 1.5)
            case "barbell":
                if animation.view == .front { line(wristL, wristR, .primary, width: w * 0.5) }
                let r = 0.16 * scale
                ctx.stroke(Path(ellipseIn: CGRect(x: P(wristL).x - r, y: P(wristL).y - r, width: 2 * r, height: 2 * r)),
                           with: .color(.primary.opacity(0.8)), lineWidth: w * 0.45)
            case "dumbbell", "kettlebell":
                for (wrist, opacity) in [(wristR, 0.3), (wristL, 0.9)] {
                    let r = (prop.type == "kettlebell" ? 0.075 : 0.055) * scale
                    let c = P(wrist)
                    ctx.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)), with: .color(.primary.opacity(opacity)))
                }
            case "barAtHands":
                let c = P(wristL), r = 0.035 * scale
                ctx.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)), with: .color(.gray))
                line(CGPoint(x: wristL.x - 0.3, y: wristL.y), CGPoint(x: wristL.x + 0.3, y: wristL.y), .gray.opacity(0.4), width: 2)
            case "plateAtFeet":
                let a = j["ankleL"] ?? .zero, hip = j["hip"] ?? .zero
                let dir = CGPoint(x: a.x - hip.x, y: a.y - hip.y)
                let len = max(0.001, hypot(dir.x, dir.y))
                let n = CGPoint(x: -dir.y / len * 0.25, y: dir.x / len * 0.25)
                line(CGPoint(x: a.x + n.x, y: a.y + n.y), CGPoint(x: a.x - n.x, y: a.y - n.y), .gray.opacity(0.6), width: w * 0.7)
            default: break
            }
        }

        // Kropp: fjerneste side først (svak), så overkropp, så nærmeste side
        let segments: [(String, String, Set<Muscle>)] = [
            ("hip", "knee", [.quads, .hamstrings, .glutes]), ("knee", "ankle", [.calves]), ("ankle", "toe", [.calves]),
            ("sh", "elbow", [.biceps, .triceps, .sideDelts]), ("elbow", "wrist", []),
        ]
        func color(_ muscles: Set<Muscle>) -> Color {
            if let h = highlight, muscles.contains(h) { return .orange }
            return .primary
        }
        let farOpacity = animation.view == .front ? 1.0 : 0.3
        for (a, b, m) in segments {
            line(j[a + "R"] ?? .zero, j[b + "R"] ?? .zero, color(m).opacity(farOpacity), width: w)
        }
        let trunkMuscles: Set<Muscle> = [.chest, .lats, .upperBack, .abs]
        line(j["hip"] ?? .zero, j["neck"] ?? .zero, color(trunkMuscles), width: w * 1.5)
        if animation.view == .front {
            line(j["shL"] ?? .zero, j["shR"] ?? .zero, color(trunkMuscles), width: w)
            line(j["hipL"] ?? .zero, j["hipR"] ?? .zero, .primary, width: w)
        }
        for (a, b, m) in segments {
            line(j[a + "L"] ?? .zero, j[b + "L"] ?? .zero, color(m), width: w)
        }
        let head = P(j["head"] ?? .zero), r = Seg.head * scale
        ctx.fill(Path(ellipseIn: CGRect(x: head.x - r, y: head.y - r, width: 2 * r, height: 2 * r)), with: .color(.primary))
    }
}

/// Viser ekte/AI-video hvis den finnes i appen (`<øvelses-id>.mp4`), ellers animasjonen.
struct ExerciseMediaView: View {
    let exercise: Exercise

    var body: some View {
        Group {
            if let url = videoURL {
                LoopingVideo(url: url)
            } else if let anim = ExerciseAnimationStore.animation(for: exercise.id) {
                StickFigureView(animation: anim, highlight: exercise.primary)
                    .padding()
            } else {
                Image(systemName: "figure.strengthtraining.traditional")
                    .font(.system(size: 80)).foregroundStyle(.orange)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 260)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var videoURL: URL? {
        ["mp4", "mov", "m4v"].lazy.compactMap { Bundle.main.url(forResource: exercise.id, withExtension: $0) }.first
    }
}

private struct LoopingVideo: View {
    let url: URL
    @State private var player: AVQueuePlayer?
    @State private var looper: AVPlayerLooper?

    var body: some View {
        VideoPlayer(player: player)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .onAppear {
                let queue = AVQueuePlayer()
                queue.isMuted = true
                looper = AVPlayerLooper(player: queue, templateItem: AVPlayerItem(url: url))
                player = queue
                queue.play()
            }
            .onDisappear { player?.pause() }
    }
}
