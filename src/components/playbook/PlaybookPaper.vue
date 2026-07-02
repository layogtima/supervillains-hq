<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Masthead from "./Masthead.vue";
import ArticleBlock from "./ArticleBlock.vue";
import type { ArticleView } from "./ArticleBlock.vue";
import { hashString, mulberry32, pick, shuffled } from "./rng";

interface Edition {
    meta: {
        date: string;
        volume: number;
        issue: number;
        edition: string;
        price: string;
        motto: string;
        laughterIndexVariants: string[];
        breakingTicker: string[];
        scrapeFreshness: string;
    };
    articles: (Omit<ArticleView, "headline"> & {
        headlines: string[];
        weight: number;
    })[];
    classifieds: { heading: string; text: string }[];
    horoscopes: { prop: string; sign: string; text: string }[];
    letters: { from: string; text: string; editorReply: string }[];
    ads: { title: string; copy: string }[];
}

const edition = ref<Edition | null>(null);
const failed = ref(false);
const seed = ref(0);
const printRun = ref(0); // bumps to retrigger the re-print transition
const regenState = ref<"idle" | "printing" | "cooldown">("idle");
const regenNote = ref("");

function roman(n: number): string {
    const table: [number, string][] = [
        [1000, "M"],
        [900, "CM"],
        [500, "D"],
        [400, "CD"],
        [100, "C"],
        [90, "XC"],
        [50, "L"],
        [40, "XL"],
        [10, "X"],
        [9, "IX"],
        [5, "V"],
        [4, "IV"],
        [1, "I"],
    ];
    let out = "";
    for (const [v, s] of table)
        while (n >= v) {
            out += s;
            n -= v;
        }
    return out || "I";
}

onMounted(async () => {
    try {
        const res = await fetch("/api/playbook/latest");
        if (!res.ok) throw new Error(String(res.status));
        edition.value = await res.json();
        // Canonical nightly layout: everyone sees the same paper until they hit REGEN.
        seed.value = hashString(
            edition.value!.meta.date + ":" + edition.value!.meta.issue,
        );
    } catch {
        failed.value = true;
    }
});

// Everything presentational derives from the seed — a new seed is a new front page.
const view = computed(() => {
    const e = edition.value;
    if (!e) return null;
    const rand = mulberry32(seed.value);

    const articles: (ArticleView & { weight: number })[] = e.articles.map(
        (a) => ({
            ...a,
            headline: pick(a.headlines, rand) ?? a.headlines[0] ?? "",
        }),
    );
    const lead = articles.reduce(
        (best, a) => (a.weight > best.weight ? a : best),
        articles[0],
    );
    const rest = shuffled(
        articles.filter((a) => a !== lead),
        rand,
    );

    return {
        lead,
        rest,
        laughterIndex: pick(e.meta.laughterIndexVariants, rand) ?? "",
        ticker: shuffled(e.meta.breakingTicker, rand),
        classifieds: shuffled(e.classifieds, rand).slice(0, 6),
        horoscopes: shuffled(e.horoscopes, rand),
        letters: e.letters,
        ads: shuffled(e.ads, rand),
        clipRotation: (rand() - 0.5) * 7,
        dateline:
            `Vol. ${roman(e.meta.volume)} · No. ${e.meta.issue} — Bengaluru — ${formatDate(e.meta.date)} — ${e.meta.edition}`.toUpperCase(),
    };
});

function formatDate(iso: string): string {
    const d = new Date(iso + "T06:00:00+05:30");
    return d.toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

async function regen() {
    if (regenState.value === "printing") return;
    // Instant gratification: re-roll the layout locally while the presses run.
    seed.value = (Math.random() * 0xffffffff) >>> 0;
    printRun.value++;

    if (regenState.value === "cooldown") return;
    regenState.value = "printing";
    regenNote.value =
        "The presses are running — a genuinely new edition in a minute or two…";
    try {
        const res = await fetch("/api/playbook/regen", { method: "POST" });
        if (res.status === 429) {
            regenState.value = "cooldown";
            regenNote.value =
                "Presses cooling down — enjoy this reshuffled reprint meanwhile.";
            setTimeout(() => {
                regenState.value = "idle";
                regenNote.value = "";
            }, 30_000);
            return;
        }
        if (!res.ok) throw new Error(String(res.status));
        edition.value = await res.json();
        printRun.value++;
        regenState.value = "idle";
        regenNote.value = "HOT OFF THE PRESSES — an entirely new edition.";
        setTimeout(() => {
            regenNote.value = "";
        }, 6000);
    } catch {
        regenState.value = "idle";
        regenNote.value =
            "The presses jammed — reshuffled the reprint instead.";
        setTimeout(() => {
            regenNote.value = "";
        }, 6000);
    }
}
</script>

<template>
    <div class="paper-grain min-h-screen text-ink">
        <!-- Presses jammed -->
        <main v-if="failed" class="max-w-xl mx-auto pt-32 px-6 text-center">
            <h1 class="font-blackletter text-6xl mb-4">The Playbook</h1>
            <div
                class="stamp inline-block px-4 py-2 text-2xl rotate-[-3deg] mb-6"
            >
                Presses Jammed
            </div>
            <p class="font-body italic text-lg">
                Tonight's print run hasn't arrived. The Badger has been
                informed. Check back after the 3 AM press run — or knock on
                <a href="/" class="underline">supervillains.wtf</a>.
            </p>
        </main>

        <!-- The paper -->
        <Transition name="reprint">
            <main
                v-if="view && edition"
                :key="printRun"
                class="max-w-[1100px] mx-auto px-3 sm:px-6 pb-10 border-x border-ink/20"
            >
                <Masthead
                    :laughter-index="view.laughterIndex"
                    :price="edition.meta.price"
                    :dateline="view.dateline"
                    :motto="edition.meta.motto"
                    :clip-rotation="view.clipRotation"
                />

                <!-- Breaking ticker -->
                <div class="flex items-stretch gap-2 my-3 overflow-hidden">
                    <span
                        class="stamp shrink-0 px-2 py-1 text-xs sm:text-sm rotate-[-1.5deg] self-center"
                        >Breaking News</span
                    >
                    <div
                        class="overflow-hidden grow self-center"
                        aria-hidden="true"
                    >
                        <div
                            class="ticker-track font-display font-bold text-xs sm:text-sm uppercase tracking-wider"
                        >
                            <span
                                v-for="(t, i) in [
                                    ...view.ticker,
                                    ...view.ticker,
                                ]"
                                :key="i"
                                class="mx-6"
                                >✶ {{ t }}</span
                            >
                        </div>
                    </div>
                </div>
                <div class="border-t border-ink/60"></div>

                <!-- Front page: lead + rail -->
                <div
                    class="grid grid-cols-1 lg:grid-cols-[2fr_1px_1fr] gap-6 mt-5"
                >
                    <ArticleBlock :article="view.lead" lead />
                    <div class="hidden lg:block bg-ink/30"></div>
                    <aside class="space-y-6">
                        <section
                            v-for="ad in view.ads"
                            :key="ad.title"
                            class="border-2 border-ink p-3 text-center break-inside-avoid"
                        >
                            <p
                                class="font-display font-black uppercase tracking-[0.2em] text-lg border-b border-dashed border-ink pb-1 mb-2"
                            >
                                {{ ad.title }}
                            </p>
                            <p class="font-body italic text-sm">
                                {{ ad.copy }}
                            </p>
                            <p
                                class="font-body text-[9px] uppercase tracking-widest mt-2 opacity-60"
                            >
                                A Playbook House Advertisement
                            </p>
                        </section>

                        <section class="border border-ink p-3">
                            <h3
                                class="font-display font-black uppercase tracking-[0.2em] text-center border-b-2 border-ink pb-1 mb-2"
                            >
                                Classifieds
                            </h3>
                            <ul class="divide-y divide-dashed divide-ink/40">
                                <li
                                    v-for="c in view.classifieds"
                                    :key="c.text"
                                    class="py-1.5 font-body text-[13px] leading-snug"
                                >
                                    <strong
                                        class="font-display uppercase text-[11px] tracking-wider"
                                        >{{ c.heading }}:</strong
                                    >
                                    {{ c.text }}
                                </li>
                            </ul>
                            <p
                                class="font-body text-[10px] italic text-center mt-2 opacity-60"
                            >
                                To place an advert, whisper it at any Sunday
                                jam.
                            </p>
                        </section>
                    </aside>
                </div>

                <p class="fleuron-divider my-6">❦ ❦ ❦</p>

                <!-- Remaining articles in column flow -->
                <section
                    class="news-columns columns-1 md:columns-2 xl:columns-3"
                >
                    <ArticleBlock
                        v-for="a in view.rest"
                        :key="a.slug"
                        :article="a"
                    />
                </section>

                <p class="fleuron-divider my-6">❦ ❦ ❦</p>

                <!-- Prop horoscopes -->
                <section class="border-y-4 border-double border-ink py-4">
                    <h3
                        class="font-display font-black uppercase tracking-[0.25em] text-center text-xl mb-4"
                    >
                        Your Props, Your Fate
                    </h3>
                    <div
                        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3"
                    >
                        <div
                            v-for="h in view.horoscopes"
                            :key="h.prop"
                            class="font-body text-sm leading-snug"
                        >
                            <span
                                class="font-display font-bold uppercase tracking-wider"
                                >{{ h.sign }} {{ h.prop }}:</span
                            >
                            <em> {{ h.text }}</em>
                        </div>
                    </div>
                </section>

                <!-- Letters -->
                <section class="mt-6 max-w-3xl mx-auto">
                    <h3
                        class="font-display font-black uppercase tracking-[0.25em] text-center text-xl mb-3"
                    >
                        Letters to the Editor
                    </h3>
                    <div
                        v-for="l in view.letters"
                        :key="l.from"
                        class="mb-4 font-body text-[15px]"
                    >
                        <p class="italic">“{{ l.text }}”</p>
                        <p class="text-right font-bold text-sm">
                            — {{ l.from }}
                        </p>
                        <p class="text-sm border-l-2 border-ink pl-3 mt-1">
                            {{ l.editorReply }}
                        </p>
                    </div>
                </section>

                <!-- Colophon -->
                <footer
                    class="mt-8 pt-3 border-t-2 border-ink text-center font-body text-xs italic space-y-1"
                >
                    <p>
                        The Playbook is printed nightly by robots under the
                        editorial neglect of The Badger, from field reports
                        filed on Instagram by Bengaluru's flow community.
                    </p>
                    <p>
                        Freshness of tonight's field reports:
                        <strong>{{ edition.meta.scrapeFreshness }}</strong
                        >. Complaints may be addressed to the classifieds
                        section.
                    </p>
                    <p
                        class="not-italic font-display uppercase tracking-[0.2em] text-[10px] pt-1"
                    >
                        <a href="/" class="underline"
                            >← Return to Supervillains.wtf</a
                        >
                    </p>
                </footer>
            </main>

            <!-- Loading -->
            <main v-else-if="!failed" class="pt-40 text-center">
                <p class="font-blackletter text-5xl animate-pulse">
                    The Playbook
                </p>
                <p class="font-body italic mt-3">
                    fetching tonight's print run…
                </p>
            </main>
        </Transition>
    </div>
</template>
