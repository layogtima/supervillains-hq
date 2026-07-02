<script setup lang="ts">
defineProps<{
  laughterIndex: string;
  price: string;
  dateline: string;
  motto: string;
  clipRotation: number;
}>();
</script>

<template>
  <header class="relative pt-6 pb-2">
    <!-- Ears -->
    <div class="flex justify-between items-end text-[11px] sm:text-xs font-body italic px-1">
      <div class="max-w-[38%]">
        <span class="not-italic font-bold uppercase tracking-wider">The Laughter Index:</span>
        {{ laughterIndex }}
      </div>
      <div class="text-right max-w-[38%] pt-8 sm:pt-0">
        Price: {{ price }}<br />
        <span class="uppercase not-italic tracking-widest">Printed nightly by robots</span>
      </div>
    </div>

    <!-- Masthead -->
    <h1
      class="font-blackletter text-center text-6xl sm:text-8xl lg:text-9xl leading-none mt-2 mb-3 tracking-tight"
    >
      The Playbook
    </h1>

    <!-- Torn red clipping, pasted over the masthead rule -->
    <a
      href="https://www.instagram.com/supervillains.wtf"
      target="_blank"
      rel="noopener"
      class="torn-clip block mx-auto mb-3 w-24 px-3 py-2 text-center no-underline sm:absolute sm:mx-0 sm:mb-0 sm:right-4 sm:top-14 sm:w-32"
      :style="{ transform: `rotate(${clipRotation}deg)` }"
    >
      <img src="/assets/img/logo/badger.png" alt="The Badger" class="w-10 sm:w-14 mx-auto" />
      <span class="block text-white font-display font-black text-[9px] sm:text-[11px] uppercase leading-tight"
        >Supervillains<br />.wtf</span
      >
    </a>

    <div class="double-rule"></div>
    <div
      class="flex flex-wrap justify-center gap-x-3 py-1.5 text-[10px] sm:text-xs font-display font-bold uppercase tracking-[0.18em] text-center"
    >
      <span>{{ dateline }}</span>
      <span aria-hidden="true">—</span>
      <span class="italic normal-case tracking-normal font-body">“{{ motto }}”</span>
    </div>
    <div class="double-rule"></div>
  </header>
</template>
