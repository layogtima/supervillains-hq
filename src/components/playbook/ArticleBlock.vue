<script setup lang="ts">
export interface ArticleView {
  slug: string;
  kicker: string;
  headline: string;
  subhead: string;
  byline: { name: string; title: string };
  body: string[];
  pullQuote: string;
  imagePath: string;
  imageCaption: string;
  imageCredit: string;
  sources: string[];
}

defineProps<{ article: ArticleView; lead?: boolean }>();
</script>

<template>
  <article :class="lead ? '' : 'break-inside-avoid mb-6'">
    <p v-if="article.kicker" class="font-display font-black text-press-red text-[11px] tracking-[0.25em] uppercase mb-1">
      ★ {{ article.kicker }} ★
    </p>
    <h2
      class="font-display font-black uppercase leading-[0.95] text-balance"
      :class="lead ? 'text-4xl sm:text-5xl lg:text-6xl mb-2' : 'text-xl sm:text-2xl mb-1.5'"
    >
      {{ article.headline }}
    </h2>
    <p v-if="article.subhead" class="font-body italic mb-2" :class="lead ? 'text-lg' : 'text-sm'">
      {{ article.subhead }}
    </p>
    <p class="font-display text-[11px] uppercase tracking-[0.15em] border-y border-ink/60 py-1 mb-3">
      By <strong>{{ article.byline.name }}</strong> · {{ article.byline.title }}
    </p>

    <figure v-if="article.imagePath" class="mb-3 border border-ink p-1 bg-paper-dark">
      <span class="halftone"><img :src="article.imagePath" :alt="article.imageCaption" loading="lazy" /></span>
      <figcaption class="font-body text-xs italic pt-1 px-1">
        {{ article.imageCaption }}
        <span class="not-italic uppercase text-[9px] tracking-wider block opacity-70">{{ article.imageCredit }}</span>
      </figcaption>
    </figure>

    <div
      class="font-body text-[15px] leading-relaxed text-justify hyphens-auto"
      :class="lead ? 'news-columns columns-1 md:columns-2 xl:columns-3' : ''"
    >
      <template v-for="(para, i) in article.body" :key="i">
        <blockquote
          v-if="article.pullQuote && i === 1"
          class="border-y-2 border-ink my-3 py-2 font-display font-bold text-lg leading-snug text-center break-inside-avoid"
        >
          {{ article.pullQuote }}
        </blockquote>
        <p class="mb-2.5" :class="lead && i === 0 ? 'drop-cap' : ''">{{ para }}</p>
      </template>
    </div>

    <p v-if="article.sources.length" class="font-body text-[10px] italic opacity-60 mt-1">
      As witnessed on
      <a
        v-for="(src, i) in article.sources"
        :key="src"
        :href="src"
        target="_blank"
        rel="noopener"
        class="underline"
      >Instagram{{ i < article.sources.length - 1 ? ',' : '' }}</a
      >, where all good journalism begins.
    </p>
  </article>
</template>
