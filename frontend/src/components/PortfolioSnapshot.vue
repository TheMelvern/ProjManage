<template>
  <section class="snapshot" :aria-label="title">
    <header>
      <h2>{{ title }}</h2>
      <p>{{ projects.length }} {{ projects.length === 1 ? 'project' : 'projects' }} · Generated {{ new Date(data.generatedAt).toLocaleString() }}</p>
    </header>
    <p v-if="!projects.length">This snapshot contains no projects.</p>
    <div v-else class="snapshot-scroll" tabindex="0" role="region" :aria-label="title + ' project table'">
      <table>
        <thead><tr><th v-for="column in snapshotColumns" :key="column.key" scope="col">{{ column.label }}</th></tr></thead>
        <tbody><tr v-for="project in projects" :key="project.id">
          <td v-for="column in snapshotColumns" :key="column.key">{{ project[column.key] ?? '—' }}</td>
        </tr></tbody>
      </table>
    </div>
  </section>
</template>
<script setup>
import { computed } from 'vue';
import { snapshotColumns } from '../utils/portfolioSnapshot';
const props = defineProps({ data: { type: Object, required: true }, title: { type: String, required: true } });
const projects = computed(() => props.data.projects || []);
</script>
<style scoped>
.snapshot{min-inline-size:0;padding:16px;border:1px solid var(--pmo-border);border-radius:12px;background:var(--pmo-panel);color:var(--pmo-text)}
.snapshot p{margin:6px 0 12px;color:var(--pmo-muted)}
.snapshot-scroll{max-inline-size:100%;overflow:auto}
table{inline-size:100%;border-collapse:collapse;text-align:start}
th,td{padding:10px 12px;text-align:start;border-block-end:1px solid var(--pmo-border)}
th{background:var(--pmo-surface-alt)}
td{overflow-wrap:anywhere;min-inline-size:6rem}
</style>
