import SwiftData
import SwiftUI

/// Treningssteder med konkret utstyr og vekter. Hvert sted får sitt eget program.
struct EquipmentSetupView: View {
    @Bindable var profile: UserProfile
    @Environment(\.modelContext) private var context
    @Query private var scans: [BodyScan]
    @State private var locations: [TrainingLocation] = []
    @State private var changed = false

    var body: some View {
        List {
            Section {
                ForEach($locations) { $loc in
                    NavigationLink {
                        LocationEditor(location: $loc)
                    } label: {
                        HStack {
                            Image(systemName: loc.kind.symbol).foregroundStyle(.orange).frame(width: 28)
                            VStack(alignment: .leading) {
                                Text(loc.name).font(.headline)
                                Text(loc.summary).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if loc.id.uuidString == profile.activeLocationId || (profile.activeLocationId.isEmpty && loc.id == locations.first?.id) {
                                Text("Aktiv").font(.caption.bold()).foregroundStyle(.orange)
                            }
                        }
                    }
                    .swipeActions(edge: .leading) {
                        Button("Bruk nå") { profile.activeLocationId = loc.id.uuidString }.tint(.orange)
                    }
                }
                .onDelete { idx in
                    guard locations.count > idx.count else { return }
                    locations.remove(atOffsets: idx)
                }
            } header: {
                Text("Hvor trener du?")
            } footer: {
                Text("Sveip til høyre for å velge hvor du trener nå. Programmet tilpasses utstyret og vektene på hvert sted.")
            }

            Section {
                Menu {
                    Button("Treningssenter") { add(.gym()) }
                    Button("Hjemmegym (stang, stativ, benk)") { add(.homeGym()) }
                    Button("Hjemme med manualer") { add(.homeDumbbells()) }
                    Button("Uten utstyr (hotell, hytte, reise)") { add(.bodyweight()) }
                } label: {
                    Label("Legg til treningssted", systemImage: "plus.circle.fill")
                }
            }
        }
        .navigationTitle("Utstyr & steder")
        .onAppear { locations = profile.locations }
        .onChange(of: locations) { _, new in
            profile.locations = new
            changed = true
        }
        .onDisappear {
            if changed {
                CoachService.regenerateAllPrograms(profile: profile, scans: scans, context: context)
            }
        }
    }

    private func add(_ loc: TrainingLocation) {
        var l = loc
        if locations.contains(where: { $0.name == l.name }) { l.name += " 2" }
        locations.append(l)
    }
}

struct LocationEditor: View {
    @Binding var location: TrainingLocation

    private static let dumbbellOptions: [Double] = [1, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10, 12, 12.5, 14, 15, 16, 17.5, 18, 20,
                                                    22, 22.5, 24, 25, 26, 27.5, 28, 30, 32, 34, 35, 36, 38, 40, 42, 44, 45, 46, 48, 50]
    private static let kettlebellOptions: [Double] = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48]

    var body: some View {
        Form {
            Section {
                TextField("Navn", text: $location.name)
                Picker("Type", selection: $location.kind) {
                    ForEach(TrainingLocation.Kind.allCases, id: \.self) { Label($0.label, systemImage: $0.symbol).tag($0) }
                }
                Menu("Fyll ut fra mal") {
                    Button("Fullt treningssenter") { applyPreset(.gym()) }
                    Button("Hjemmegym") { applyPreset(.homeGym()) }
                    Button("Bare manualer") { applyPreset(.homeDumbbells()) }
                    Button("Ingen utstyr") { applyPreset(.bodyweight()) }
                }
            }

            ForEach(EquipmentCategory.allCases) { category in
                Section(category.rawValue) {
                    ForEach(EquipmentItem.allCases.filter { $0.category == category }) { item in
                        Toggle(isOn: binding(for: item)) {
                            Label(item.label, systemImage: item.symbol)
                        }
                    }
                }
            }

            if location.equipment.contains(.dumbbells) {
                Section {
                    WeightGrid(options: Self.dumbbellOptions, selected: $location.dumbbellWeights)
                } header: {
                    Text("Manualer du har (kg per stk)")
                } footer: {
                    Text("Justerbare manualer? Velg alle trinnene de kan stilles til. PT-en foreslår bare vekter du faktisk har.")
                }
            }
            if location.equipment.contains(.kettlebell) {
                Section("Kettlebells (kg)") {
                    WeightGrid(options: Self.kettlebellOptions, selected: $location.kettlebellWeights)
                }
            }
            if location.equipment.contains(.barbell) {
                Section("Vektstang") {
                    Stepper("Skiver totalt inkl. stang: \(Int(location.barbellMaxKg ?? 100)) kg",
                            value: Binding(get: { location.barbellMaxKg ?? 100 }, set: { location.barbellMaxKg = $0 }),
                            in: 20...400, step: 5)
                }
            }
        }
        .navigationTitle(location.name)
    }

    private func binding(for item: EquipmentItem) -> Binding<Bool> {
        Binding(
            get: { location.equipment.contains(item) },
            set: { on in
                if on { location.equipment.insert(item) } else { location.equipment.remove(item) }
                if on, item == .dumbbells, location.dumbbellWeights.isEmpty {
                    location.dumbbellWeights = [2, 4, 6, 8, 10, 12.5, 15, 17.5, 20]
                }
                if on, item == .kettlebell, location.kettlebellWeights.isEmpty {
                    location.kettlebellWeights = [8, 12, 16]
                }
            })
    }

    private func applyPreset(_ preset: TrainingLocation) {
        location.equipment = preset.equipment
        location.dumbbellWeights = preset.dumbbellWeights
        location.kettlebellWeights = preset.kettlebellWeights
        location.barbellMaxKg = preset.barbellMaxKg
    }
}

private struct WeightGrid: View {
    let options: [Double]
    @Binding var selected: [Double]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 58), spacing: 8)], spacing: 8) {
            ForEach(options, id: \.self) { w in
                let on = selected.contains(w)
                Button {
                    if on { selected.removeAll { $0 == w } } else { selected = (selected + [w]).sorted() }
                } label: {
                    Text(w.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(w))" : String(format: "%.1f", w))
                        .font(.subheadline.monospacedDigit().bold())
                        .frame(maxWidth: .infinity, minHeight: 36)
                        .background(on ? Color.orange : Color.gray.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
                        .foregroundStyle(on ? .white : .primary)
                }
                .buttonStyle(.plain)
                .sensoryFeedback(.selection, trigger: on)
            }
        }
        .padding(.vertical, 4)
    }
}
