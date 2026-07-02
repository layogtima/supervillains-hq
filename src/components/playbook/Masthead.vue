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
        <div
            class="flex justify-between items-start text-[11px] sm:text-xs font-body italic px-1"
        >
            <div class="max-w-[34%] hidden">
                <span class="not-italic font-bold uppercase tracking-wider"
                    >The Laughter Index:</span
                >
                {{ laughterIndex }}
            </div>
        </div>

        <!-- The Badger — an ink editor's seal (centered on mobile, right emblem on desktop) -->
        <a
            href="https://www.instagram.com/supervillains.wtf"
            target="_blank"
            rel="noopener"
            class="block mx-auto mb-2 w-24 no-underline text-center sm:absolute sm:mx-0 sm:mb-0 sm:right-2 sm:top-9 sm:w-28"
            :style="{ transform: `rotate(${clipRotation * 0.35}deg)` }"
        >
            <span
                class="badger-seal flex aspect-square w-full items-center justify-center"
            >
                <img
                    src="/assets/img/logo/badger-ink.png"
                    alt="The Badger, alleged Editor-in-Chief"
                    class="w-3/4"
                />
            </span>
            <span
                class="block font-display text-[8px] sm:text-[9px] uppercase tracking-[0.18em] mt-1 text-ink"
                >The Badger · Ed.</span
            >
        </a>

        <!-- Masthead -->
        <h1
            class="font-blackletter text-center text-6xl sm:text-8xl lg:text-9xl leading-none mt-2 tracking-tight"
        >
            The Playbook
        </h1>
        <p
            class="text-center font-display uppercase tracking-[0.3em] text-[11px] sm:text-sm mt-1 mb-3"
        >
            {{ motto }}
        </p>

        <div class="double-rule"></div>
        <div
            class="flex flex-wrap justify-center gap-x-3 py-1.5 text-[10px] sm:text-xs font-display font-bold uppercase tracking-[0.18em] text-center"
        >
            <span>{{ dateline }}</span>
        </div>
        <div class="double-rule"></div>
    </header>
</template>
