<template>
  <main class="workplace-home">
    <header class="workplace-intro">
      <div>
        <h1>Workplace</h1>
        <p>Open your projects, people tools and approval updates.</p>
      </div>
      <router-link class="pmo-control primary" to="/notifications">
        <span class="material-symbols-outlined" aria-hidden="true">notifications</span>
        Open notification inbox
      </router-link>
    </header>

    <div class="workplace-grid">
      <section v-for="group in groups" :key="group.title" class="workplace-card"
        :class="{ 'workplace-card-wide': group.title === 'Delivery' }">
        <span class="record-icon material-symbols-outlined" aria-hidden="true">{{ group.icon }}</span>
        <h2>{{ group.title }}</h2>
        <p>{{ group.description }}</p>
        <ul>
          <li v-for="item in group.items" :key="item.to">
            <router-link :to="item.to">
              <span>{{ item.label }}</span>
              <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
            </router-link>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed } from 'vue';
import { allowedWorkplaceGroups } from '../../workplaceNavigation';

const props = defineProps({ role: String });
const groups = computed(() => allowedWorkplaceGroups(props.role));
</script>

<style scoped>
.workplace-home {
  width: 100%;
  max-width: 1220px;
  margin-inline: auto;
  padding: clamp(24px, 4vw, 48px) var(--product-gutter);
}
.workplace-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: clamp(20px, 4vw, 40px);
  margin-block-end: 20px;
  background: linear-gradient(125deg, var(--pmo-accent-soft), var(--pmo-panel) 72%);
  border: 1px solid var(--pmo-border);
  border-radius: var(--product-radius);
}
.workplace-intro h1, .workplace-card h2 { margin: 0; }
.workplace-intro p, .workplace-card p { margin: 6px 0 0; }
.workplace-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.workplace-card {
  min-width: 0;
  padding: var(--product-panel-space);
  border: 1px solid var(--pmo-border);
  border-radius: var(--product-radius);
  background: var(--pmo-panel);
}
.workplace-card-wide { grid-column: 1 / -1; }
.workplace-card .record-icon { margin-block-end: 12px; }
.workplace-card ul {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: grid;
  gap: 6px 16px;
}
.workplace-card-wide ul {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
}
.workplace-card ul a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 8px 12px;
  border-radius: 9px;
  background: var(--pmo-surface-alt);
  font-weight: 600;
  text-decoration: none;
}
.workplace-card ul a:hover { background: var(--pmo-accent-soft); }
.workplace-card ul a .material-symbols-outlined { font-size: 18px; }
@media (max-width: 660px) {
  .workplace-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
