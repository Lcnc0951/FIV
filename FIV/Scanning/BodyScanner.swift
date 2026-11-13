import ARKit
import Combine
import simd

enum ScanPhase: Equatable {
    case idle, countdown(Int), front, turn, side, finished, failed(String)
}

/// Snapshot av skjelettets leddposisjoner i verdenskoordinater.
struct SkeletonSnapshot {
    private let joints: [String: SIMD3<Float>]
    let facing: SIMD3<Float>

    init(anchor: ARBodyAnchor) {
        let skeleton = anchor.skeleton
        var j: [String: SIMD3<Float>] = [:]
        for (i, name) in skeleton.definition.jointNames.enumerated() where skeleton.isJointTracked(i) {
            let m = anchor.transform * skeleton.jointModelTransforms[i]
            j[name] = SIMD3(m.columns.3.x, m.columns.3.y, m.columns.3.z)
        }
        joints = j
        // Retning kroppen vender: fra ankel mot tær (robust), ellers rotleddets z-akse.
        var forward = SIMD3<Float>(0, 0, 0)
        for side in ["left", "right"] {
            if let foot = j["\(side)_foot_joint"], let toes = j["\(side)_toes_joint"] { forward += toes - foot }
        }
        if simd_length(SIMD2(forward.x, forward.z)) < 0.01 {
            let z = anchor.transform.columns.2
            forward = SIMD3(z.x, z.y, z.z)
        }
        let horizontal = SIMD3<Float>(forward.x, 0, forward.z)
        facing = simd_length(horizontal) > 0.001 ? simd_normalize(horizontal) : SIMD3(0, 0, 1)
    }

    subscript(_ name: String) -> SIMD3<Float>? { joints[name] }

    var head: SIMD3<Float>? { joints["head_joint"] }
    var neck: SIMD3<Float>? { joints["neck_1_joint"] }
    var hips: SIMD3<Float>? { joints["hips_joint"] }
    var leftShoulder: SIMD3<Float>? { joints["left_arm_joint"] }
    var rightShoulder: SIMD3<Float>? { joints["right_arm_joint"] }
    var leftElbow: SIMD3<Float>? { joints["left_forearm_joint"] }
    var rightElbow: SIMD3<Float>? { joints["right_forearm_joint"] }
    var leftHand: SIMD3<Float>? { joints["left_hand_joint"] }
    var rightHand: SIMD3<Float>? { joints["right_hand_joint"] }
    var leftHip: SIMD3<Float>? { joints["left_upLeg_joint"] }
    var rightHip: SIMD3<Float>? { joints["right_upLeg_joint"] }
    var leftKnee: SIMD3<Float>? { joints["left_leg_joint"] }
    var rightKnee: SIMD3<Float>? { joints["right_leg_joint"] }
    var leftFoot: SIMD3<Float>? { joints["left_foot_joint"] }
    var rightFoot: SIMD3<Float>? { joints["right_foot_joint"] }

    var overlayJoints: [SIMD3<Float>] {
        [head, neck, leftShoulder, rightShoulder, leftElbow, rightElbow, leftHand, rightHand,
         hips, leftHip, rightHip, leftKnee, rightKnee, leftFoot, rightFoot].compactMap { $0 }
    }
}

/// To-posisjons kroppsskanning (forfra + fra siden) med ARKit body tracking og LiDAR.
final class BodyScanner: NSObject, ObservableObject, ARSessionDelegate {

    static var isSupported: Bool { ARBodyTrackingConfiguration.isSupported }

    @Published private(set) var phase: ScanPhase = .idle
    @Published private(set) var instruction = "Gjør deg klar"
    @Published private(set) var progress: Double = 0
    @Published private(set) var bodyDetected = false
    @Published private(set) var overlayPoints: [CGPoint] = []
    @Published private(set) var result: ScanMeasurements?

    let session = ARSession()

    private let queue = DispatchQueue(label: "no.fiv.bodyscan", qos: .userInitiated)
    private let lock = NSLock()
    private var _viewportSize: CGSize = .zero

    // Kun tilgang fra `queue`
    private var scanPhase: ScanPhase = .idle
    private var frameCounter = 0
    private var validStreak = 0
    private var frontSamples = 0
    private var sideSamples = 0
    private var samples: [String: [Float]] = [:]
    private var usedLiDAR = false
    private var lastInstruction = ""

    private static let frontTarget = 36
    private static let sideTarget = 24

    var viewportSize: CGSize {
        get { lock.lock(); defer { lock.unlock() }; return _viewportSize }
        set { lock.lock(); _viewportSize = newValue; lock.unlock() }
    }

    // MARK: Livssyklus

    func start(countdownSeconds: Int = 10) {
        guard Self.isSupported else {
            phase = .failed("Denne enheten støtter ikke kroppssporing.")
            return
        }
        let config = ARBodyTrackingConfiguration()
        config.automaticSkeletonScaleEstimationEnabled = true
        var semantics: ARConfiguration.FrameSemantics = [.bodyDetection]
        if ARBodyTrackingConfiguration.supportsFrameSemantics(.personSegmentationWithDepth) {
            semantics.insert(.personSegmentationWithDepth)
        }
        // LiDAR-dybde der det støttes sammen med kroppssporing (iPhone Pro-modeller)
        let withLiDAR = semantics.union([.smoothedSceneDepth])
        if ARBodyTrackingConfiguration.supportsFrameSemantics(withLiDAR) {
            semantics = withLiDAR
        }
        config.frameSemantics = semantics

        session.delegate = self
        session.delegateQueue = queue
        session.run(config, options: [.resetTracking, .removeExistingAnchors])

        queue.async { [weak self] in self?.resetState() }
        runCountdown(countdownSeconds)
    }

    func stop() {
        session.pause()
    }

    private func runCountdown(_ seconds: Int) {
        publish { $0.phase = .countdown(seconds) }
        if seconds <= 0 {
            queue.async { [weak self] in
                self?.scanPhase = .front
                self?.say("Stå rett, se mot telefonen, armene litt ut fra kroppen.")
            }
            publish { $0.phase = .front }
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
            self?.runCountdown(seconds - 1)
        }
    }

    private func resetState() {
        scanPhase = .idle
        frameCounter = 0
        validStreak = 0
        frontSamples = 0
        sideSamples = 0
        samples = [:]
        usedLiDAR = false
        lastInstruction = ""
    }

    // MARK: ARSessionDelegate

    func session(_ session: ARSession, didFailWithError error: Error) {
        publish { $0.phase = .failed(error.localizedDescription) }
    }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        frameCounter += 1
        guard frameCounter % 3 == 0 else { return }

        guard let body = frame.anchors.lazy.compactMap({ $0 as? ARBodyAnchor }).first, body.isTracked else {
            validStreak = 0
            publish { $0.bodyDetected = false; $0.overlayPoints = [] }
            if scanPhase == .front || scanPhase == .side {
                say("Jeg ser deg ikke. Gå 2,5 til 3 meter unna, hele kroppen i bildet.")
            }
            return
        }

        let skeleton = SkeletonSnapshot(anchor: body)
        updateOverlay(skeleton: skeleton, camera: frame.camera)

        switch scanPhase {
        case .front: handleFront(frame: frame, skeleton: skeleton)
        case .turn: handleTurn(frame: frame, skeleton: skeleton)
        case .side: handleSide(frame: frame, skeleton: skeleton)
        default: break
        }
    }

    // MARK: Faser

    private func handleFront(frame: ARFrame, skeleton: SkeletonSnapshot) {
        if let problem = frontProblem(frame: frame, skeleton: skeleton) {
            validStreak = 0
            say(problem)
            return
        }
        validStreak += 1
        guard validStreak > 4, let geo = FrameGeometry(frame: frame) else { return }
        say("Perfekt. Stå helt stille.")
        if collectFront(skeleton: skeleton, geo: geo) {
            frontSamples += 1
            usedLiDAR = usedLiDAR || geo.usesLiDAR
        }
        let p = Double(frontSamples) / Double(Self.frontTarget) * 0.5
        publish { $0.progress = p }
        if frontSamples >= Self.frontTarget {
            scanPhase = .turn
            validStreak = 0
            publish { $0.phase = .turn }
            say("Bra! Snu deg en kvart runde mot venstre, så jeg ser deg fra siden. Armene ned langs siden.", force: true)
        }
    }

    private func handleTurn(frame: ARFrame, skeleton: SkeletonSnapshot) {
        guard isSideways(frame: frame, skeleton: skeleton) else {
            validStreak = 0
            return
        }
        validStreak += 1
        if validStreak > 6 {
            scanPhase = .side
            validStreak = 0
            publish { $0.phase = .side }
        }
    }

    private func handleSide(frame: ARFrame, skeleton: SkeletonSnapshot) {
        guard isSideways(frame: frame, skeleton: skeleton), fullBodyVisible(frame: frame, skeleton: skeleton) else {
            say("Stå sidelengs til telefonen med hele kroppen i bildet.")
            return
        }
        guard let geo = FrameGeometry(frame: frame) else { return }
        say("Stå stille, pust rolig ut.")
        if collectSide(skeleton: skeleton, geo: geo) { sideSamples += 1 }
        let p = 0.5 + Double(sideSamples) / Double(Self.sideTarget) * 0.5
        publish { $0.progress = p }
        if sideSamples >= Self.sideTarget { finish() }
    }

    // MARK: Validering

    private func cameraRight(_ camera: ARCamera) -> SIMD3<Float> {
        // Telefonen står i portrett: kameraets native x-akse ligger langs telefonens lange side (vertikalt),
        // y-aksen er horisontal i bildet. Fortegnet er uvesentlig – vi bruker bare absoluttverdier.
        let y = camera.transform.columns.1
        return SIMD3(y.x, y.y, y.z)
    }

    private func shoulderSpan(_ skeleton: SkeletonSnapshot, camera: ARCamera) -> Float? {
        guard let l = skeleton.leftShoulder, let r = skeleton.rightShoulder else { return nil }
        return abs(simd_dot(r - l, cameraRight(camera)))
    }

    private func fullBodyVisible(frame: ARFrame, skeleton: SkeletonSnapshot) -> Bool {
        let size = frame.camera.imageResolution
        let points = [skeleton.head, skeleton.leftFoot, skeleton.rightFoot].compactMap { $0 }
        guard points.count == 3 else { return false }
        return points.allSatisfy { p in
            let pt = frame.camera.projectPoint(p, orientation: .landscapeRight, viewportSize: size)
            let nx = pt.x / size.width, ny = pt.y / size.height
            return nx > 0.03 && nx < 0.97 && ny > 0.03 && ny < 0.97
        }
    }

    private func frontProblem(frame: ARFrame, skeleton: SkeletonSnapshot) -> String? {
        guard let hips = skeleton.hips else { return "Jeg finner ikke kroppen din ennå." }
        let cam = frame.camera.transform.columns.3
        let distance = simd_distance(hips, SIMD3(cam.x, cam.y, cam.z))
        if distance < 1.8 { return "Gå litt bakover." }
        if distance > 4.2 { return "Kom litt nærmere." }
        if !fullBodyVisible(frame: frame, skeleton: skeleton) { return "Hele kroppen må være i bildet, fra hode til føtter." }
        guard let span = shoulderSpan(skeleton, camera: frame.camera), span > 0.24 else {
            return "Snu deg rett mot telefonen."
        }
        if let lh = skeleton.leftHand, let rh = skeleton.rightHand, let lHip = skeleton.leftHip, let rHip = skeleton.rightHip {
            let right = cameraRight(frame.camera)
            let handGap = min(abs(simd_dot(lh - lHip, right)), abs(simd_dot(rh - rHip, right)))
            if handGap < 0.18 { return "Løft armene litt ut fra kroppen, som en A." }
        }
        if let lf = skeleton.leftFoot, let rf = skeleton.rightFoot,
           abs(simd_dot(lf - rf, cameraRight(frame.camera))) < 0.15 {
            return "Stå med føttene i skulderbreddes avstand."
        }
        return nil
    }

    private func isSideways(frame: ARFrame, skeleton: SkeletonSnapshot) -> Bool {
        guard let span = shoulderSpan(skeleton, camera: frame.camera) else { return false }
        return span < 0.14
    }

    // MARK: Innsamling

    private func add(_ key: String, _ value: Float?) {
        guard let v = value, v.isFinite else { return }
        samples[key, default: []].append(v)
    }

    private func lerp(_ a: SIMD3<Float>, _ b: SIMD3<Float>, _ t: Float) -> SIMD3<Float> { a + (b - a) * t }

    /// Returnerer true hvis minst torso-målene lyktes.
    private func collectFront(skeleton s: SkeletonSnapshot, geo: FrameGeometry) -> Bool {
        guard let hips = s.hips, let neck = s.neck else { return false }
        let spine = neck - hips
        let up = simd_normalize(spine)

        let waist = geo.silhouetteWidth(at: lerp(hips, neck, 0.22), axis: spine, edgeDepthOffset: 0.06)
        add("waistW", waist)
        add("chestW", geo.silhouetteWidth(at: lerp(hips, neck, 0.70), axis: spine, edgeDepthOffset: 0.07))
        add("hipW", geo.silhouetteWidth(at: hips - up * 0.07, axis: spine, edgeDepthOffset: 0.07))
        if let head = s.head {
            add("neckW", geo.silhouetteWidth(at: lerp(neck, head, 0.35), axis: head - neck, edgeDepthOffset: 0.03))
            if let lf = s.leftFoot, let rf = s.rightFoot {
                // Hodeleddet sitter ~12 cm under issen, fotleddet ~8 cm over gulvet
                add("height", head.y - min(lf.y, rf.y) + 0.20)
            }
        }

        // Lemmer: bredde vinkelrett på lemmet, omkrets ≈ π × bredde
        if let sh = s.leftShoulder, let el = s.leftElbow {
            add("armL", geo.silhouetteWidth(at: lerp(sh, el, 0.5), axis: el - sh, edgeDepthOffset: 0.02))
        }
        if let sh = s.rightShoulder, let el = s.rightElbow {
            add("armR", geo.silhouetteWidth(at: lerp(sh, el, 0.5), axis: el - sh, edgeDepthOffset: 0.02))
        }
        if let hip = s.leftHip, let knee = s.leftKnee {
            add("thighL", geo.silhouetteWidth(at: lerp(hip, knee, 0.4), axis: knee - hip, edgeDepthOffset: 0.03))
        }
        if let hip = s.rightHip, let knee = s.rightKnee {
            add("thighR", geo.silhouetteWidth(at: lerp(hip, knee, 0.4), axis: knee - hip, edgeDepthOffset: 0.03))
        }

        // Lengder
        if let a = s.leftShoulder, let b = s.leftElbow, let c = s.leftHand { add("armLenL", simd_distance(a, b) + simd_distance(b, c)) }
        if let a = s.rightShoulder, let b = s.rightElbow, let c = s.rightHand { add("armLenR", simd_distance(a, b) + simd_distance(b, c)) }
        if let a = s.leftHip, let b = s.leftKnee, let c = s.leftFoot { add("legLenL", simd_distance(a, b) + simd_distance(b, c)) }
        if let a = s.rightHip, let b = s.rightKnee, let c = s.rightFoot { add("legLenR", simd_distance(a, b) + simd_distance(b, c)) }

        // Holdning forfra
        func tilt(_ l: SIMD3<Float>?, _ r: SIMD3<Float>?) -> Float? {
            guard let l, let r else { return nil }
            let horizontal = simd_length(SIMD2(r.x - l.x, r.z - l.z))
            guard horizontal > 0.05 else { return nil }
            return atan2(l.y - r.y, horizontal) * 180 / .pi
        }
        add("shoulderTilt", tilt(s.leftShoulder, s.rightShoulder))
        add("hipTilt", tilt(s.leftHip, s.rightHip))
        if let l = s.leftShoulder, let r = s.rightShoulder { add("shoulderWidth", simd_distance(l, r)) }

        return waist != nil
    }

    private func collectSide(skeleton s: SkeletonSnapshot, geo: FrameGeometry) -> Bool {
        guard let hips = s.hips, let neck = s.neck else { return false }
        let spine = neck - hips
        let up = simd_normalize(spine)
        let waist = geo.silhouetteWidth(at: lerp(hips, neck, 0.22), axis: spine, edgeDepthOffset: 0.10)
        add("waistD", waist)
        add("chestD", geo.silhouetteWidth(at: lerp(hips, neck, 0.70), axis: spine, edgeDepthOffset: 0.12))
        add("hipD", geo.silhouetteWidth(at: hips - up * 0.07, axis: spine, edgeDepthOffset: 0.12))
        if let head = s.head {
            add("neckD", geo.silhouetteWidth(at: lerp(neck, head, 0.35), axis: head - neck, edgeDepthOffset: 0.04))
            if let l = s.leftShoulder, let r = s.rightShoulder {
                let shoulderMid = (l + r) / 2
                let offset = head - shoulderMid
                add("forwardHead", simd_dot(SIMD3(offset.x, 0, offset.z), s.facing))
            }
        }
        return waist != nil
    }

    // MARK: Resultat

    private func median(_ key: String, minCount: Int = 6) -> Double? {
        guard var v = samples[key], v.count >= minCount else { return nil }
        v.sort()
        // Trimmet median: kast ytterste 20 % før vi tar midten
        let trim = v.count / 5
        let core = Array(v[trim..<(v.count - trim)])
        return Double(core[core.count / 2])
    }

    private func finish() {
        scanPhase = .finished
        func cm(_ key: String) -> Double? { median(key).map { $0 * 100 } }
        func ellipse(_ w: String, _ d: String) -> Double? {
            guard let w = cm(w), let d = cm(d) else { return nil }
            return BodyComposition.ellipseCircumference(width: w, depth: d)
        }
        func round1(_ v: Double?) -> Double? { v.map { ($0 * 10).rounded() / 10 } }

        var m = ScanMeasurements()
        m.measuredHeightCm = round1(cm("height"))
        m.shoulderWidthCm = round1(cm("shoulderWidth"))
        m.neckCm = round1(ellipse("neckW", "neckD"))
        m.chestCm = round1(ellipse("chestW", "chestD"))
        m.waistCm = round1(ellipse("waistW", "waistD"))
        m.hipCm = round1(ellipse("hipW", "hipD"))
        m.upperArmLeftCm = round1(cm("armL").map { $0 * .pi })
        m.upperArmRightCm = round1(cm("armR").map { $0 * .pi })
        m.thighLeftCm = round1(cm("thighL").map { $0 * .pi })
        m.thighRightCm = round1(cm("thighR").map { $0 * .pi })
        m.armLengthLeftCm = round1(cm("armLenL"))
        m.armLengthRightCm = round1(cm("armLenR"))
        m.legLengthLeftCm = round1(cm("legLenL"))
        m.legLengthRightCm = round1(cm("legLenR"))
        m.shoulderTiltDeg = round1(median("shoulderTilt"))
        m.hipTiltDeg = round1(median("hipTilt"))
        m.forwardHeadCm = round1(cm("forwardHead").map { max(0, $0) })
        m.usedLiDAR = usedLiDAR
        m.sampleCount = frontSamples + sideSamples

        say("Skanningen er ferdig. Bra jobba!", force: true)
        DispatchQueue.main.async { [weak self] in
            self?.result = m
            self?.progress = 1
            self?.phase = .finished
            self?.session.pause()
        }
    }

    // MARK: UI-hjelpere

    private func updateOverlay(skeleton: SkeletonSnapshot, camera: ARCamera) {
        let size = viewportSize
        guard size.width > 0 else { return }
        let pts = skeleton.overlayJoints.map { camera.projectPoint($0, orientation: .portrait, viewportSize: size) }
        publish { $0.bodyDetected = true; $0.overlayPoints = pts }
    }

    private func say(_ text: String, force: Bool = false) {
        guard force || text != lastInstruction else { return }
        lastInstruction = text
        publish { $0.instruction = text }
        VoiceCoach.shared.speak(text, interrupt: force)
    }

    private func publish(_ update: @escaping (BodyScanner) -> Void) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            update(self)
        }
    }
}
