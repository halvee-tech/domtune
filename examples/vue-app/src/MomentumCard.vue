<script setup lang="ts">
import { momentumTheme } from "./theme";
</script>

<template>
  <article
    aria-label="Vue momentum card"
    :style="{
      width: 'min(480px, 100%)',
      marginTop: '56px',
      padding: '30px',
      borderRadius: momentumTheme.card.radius,
      background: '#e5efe9',
      boxShadow: '0 24px 64px rgb(25 55 40 / 12%)'
    }"
  >
    <span>Weekly momentum</span>
    <strong>+32%</strong>
    <small>Seven-day acceleration</small>
  </article>
</template>
