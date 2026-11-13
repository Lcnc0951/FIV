import SwiftData
import SwiftUI

struct OnboardingView: View {
    @Environment(\.modelContext) private var context
    @State private var step = 0
    @State private var draft = ProfileDraft()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ProgressView(value: Double(step + 1), total: 4)
                    .padding()
                TabView(selection: $step) {
                    welcome.tag(0)
                    ProfileForm(draft: $draft, section: .body).tag(1)
                    ProfileForm(draft: $draft, section: .goal).tag(2)
                    ProfileForm(draft: $draft, section: .training).tag(3)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut, value: step)

                Button(step < 3 ? "Neste" : "Lag programmet mitt") {
                    if step < 3 { step += 1 } else { finish() }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .frame(maxWidth: .infinity)
                .padding()
            }
            .navigationTitle(step == 0 ? "" : "Om deg")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var welcome: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "figure.strengthtraining.traditional")
                .font(.system(size: 80))
                .foregroundStyle(.orange)
            Text("Hei! Jeg er din personlige trener.")
                .font(.largeTitle.bold())
                .multilineTextAlignment(.center)
            Text("Jeg skanner kroppen din med LiDAR, finner hva du bør prioritere, og lager et treningsprogram basert på den nyeste forskningen. Alt lagres kun på telefonen din.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .padding(28)
    }

    private func finish() {
        let profile = UserProfile()
        draft.apply(to: profile)
        context.insert(profile)
        CoachService.regenerateProgram(profile: profile, scans: [], context: context)
    }
}

struct ProfileDraft {
    var name = ""
    var sex: Sex = .male
    var birthYear = 1990
    var heightCm = 180.0
    var weightKg = 80.0
    var goal: Goal = .buildMuscle
    var experience: Experience = .beginner
    var daysPerWeek = 3
    var sessionMinutes = 60
    var equipment: Equipment = .fullGym
    var limitations: Set<Limitation> = []

    init() {}

    init(profile: UserProfile) {
        name = profile.name; sex = profile.sex; birthYear = profile.birthYear
        heightCm = profile.heightCm; weightKg = profile.weightKg; goal = profile.goal
        experience = profile.experience; daysPerWeek = profile.daysPerWeek
        sessionMinutes = profile.sessionMinutes; equipment = profile.equipment; limitations = profile.limitations
    }

    func apply(to p: UserProfile) {
        p.name = name; p.sex = sex; p.birthYear = birthYear; p.heightCm = heightCm; p.weightKg = weightKg
        p.goal = goal; p.experience = experience; p.daysPerWeek = daysPerWeek
        p.sessionMinutes = sessionMinutes; p.equipment = equipment; p.limitations = limitations
    }
}

struct ProfileForm: View {
    enum Section { case body, goal, training, all }
    @Binding var draft: ProfileDraft
    var section: Section = .all

    private var currentYear: Int { Calendar.current.component(.year, from: Date()) }

    var body: some View {
        Form {
            if section == .body || section == .all {
                SwiftUI.Section("Kropp") {
                    TextField("Fornavn", text: $draft.name)
                    Picker("Kjønn", selection: $draft.sex) {
                        ForEach(Sex.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    Stepper("Født: \(String(draft.birthYear))", value: $draft.birthYear, in: (currentYear - 90)...(currentYear - 14))
                    Stepper("Høyde: \(Int(draft.heightCm)) cm", value: $draft.heightCm, in: 130...220, step: 1)
                    Stepper(String(format: "Vekt: %.1f kg", draft.weightKg), value: $draft.weightKg, in: 35...250, step: 0.5)
                }
            }
            if section == .goal || section == .all {
                SwiftUI.Section("Hovedmål") {
                    ForEach(Goal.allCases) { goal in
                        Button {
                            draft.goal = goal
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(goal.label).font(.headline)
                                    Text(goal.detail).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                if draft.goal == goal { Image(systemName: "checkmark.circle.fill").foregroundStyle(.orange) }
                            }
                        }
                        .foregroundStyle(.primary)
                    }
                }
                SwiftUI.Section("Erfaring") {
                    Picker("Erfaring", selection: $draft.experience) {
                        ForEach(Experience.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }
            }
            if section == .training || section == .all {
                SwiftUI.Section("Treningshverdag") {
                    Stepper("\(draft.daysPerWeek) økter per uke", value: $draft.daysPerWeek, in: 2...6)
                    Stepper("\(draft.sessionMinutes) min per økt", value: $draft.sessionMinutes, in: 30...120, step: 5)
                    Picker("Utstyr", selection: $draft.equipment) {
                        ForEach(Equipment.allCases) { Text($0.label).tag($0) }
                    }
                }
                SwiftUI.Section {
                    ForEach(Limitation.allCases) { lim in
                        Toggle(lim.label, isOn: Binding(
                            get: { draft.limitations.contains(lim) },
                            set: { on in
                                if on { draft.limitations.insert(lim) } else { draft.limitations.remove(lim) }
                            }))
                    }
                } header: {
                    Text("Plager / skader")
                } footer: {
                    Text("Jeg bytter ut øvelser som ofte provoserer disse områdene. Ved akutte eller uforklarlige smerter: snakk med lege eller fysioterapeut.")
                }
            }
        }
    }
}
