import SwiftData
import SwiftUI

struct CoachView: View {
    private var categories: [String] {
        var seen = Set<String>()
        return CoachKnowledge.articles.map(\.category).filter { seen.insert($0).inserted }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label(CoachKnowledge.tipOfTheDay(), systemImage: "lightbulb.fill")
                } header: {
                    Text("Dagens tips")
                }
                ForEach(categories, id: \.self) { category in
                    Section(category) {
                        ForEach(CoachKnowledge.articles.filter { $0.category == category }) { article in
                            NavigationLink {
                                ArticleView(article: article)
                            } label: {
                                Label {
                                    VStack(alignment: .leading) {
                                        Text(article.title).font(.headline)
                                        Text(article.summary).font(.caption).foregroundStyle(.secondary)
                                    }
                                } icon: {
                                    Image(systemName: article.symbol).foregroundStyle(.orange)
                                }
                            }
                        }
                    }
                }
                Section {
                    Text("FIV gir generelle treningsråd basert på forskning og er ikke medisinsk rådgivning. Har du sykdom, skader eller er gravid — snakk med lege eller fysioterapeut før du starter.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Din PT")
        }
    }
}

struct ArticleView: View {
    let article: KnowledgeArticle
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Label(article.category, systemImage: article.symbol).font(.caption.bold()).foregroundStyle(.orange)
                Text(article.summary).font(.title3.bold())
                ForEach(article.body, id: \.self) { Text($0) }
                Divider()
                Text("Kilder").font(.headline)
                ForEach(article.sources, id: \.self) { Text("• \($0)").font(.caption).foregroundStyle(.secondary) }
            }
            .padding()
        }
        .navigationTitle(article.title)
    }
}

struct ProfileEditView: View {
    @Bindable var profile: UserProfile
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query private var scans: [BodyScan]
    @State private var draft = ProfileDraft()

    var body: some View {
        NavigationStack {
            ProfileForm(draft: $draft)
                .navigationTitle("Profil")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Lagre") {
                            draft.apply(to: profile)
                            CoachService.regenerateProgram(profile: profile, scans: scans, context: context)
                            dismiss()
                        }
                    }
                }
                .onAppear { draft = ProfileDraft(profile: profile) }
        }
    }
}
