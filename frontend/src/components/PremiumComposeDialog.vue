<template>
  <div v-if="open" class="premium-compose-overlay" @mousedown.self="$emit('close')" @keydown.esc.stop="$emit('close')">
    <section ref="dialog" class="premium-compose-dialog" role="dialog" aria-modal="true" :aria-labelledby="headingId" tabindex="-1">
      <header class="premium-compose-header">
        <div class="premium-compose-heading">
          <p class="premium-compose-eyebrow">{{ eyebrow }}</p>
          <h2 :id="headingId">{{ title }}</h2>
          <p v-if="description" class="premium-compose-description">{{ description }}</p>
        </div>
        <button class="premium-compose-close" type="button" aria-label="Close creation dialog" @click="$emit('close')">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>
      <div class="premium-compose-body"><p v-if="error" class="premium-compose-error" role="alert">{{ error }}</p><slot /></div>
      <footer v-if="$slots.footer" class="premium-compose-footer"><slot name="footer" /></footer>
    </section>
  </div>
</template>
<script setup>
import { nextTick, ref, watch, onUnmounted } from 'vue';
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  eyebrow: { type: String, default: 'NEW RECORD' },
  description: { type: String, default: '' },
  error: { type: String, default: '' }
});
defineEmits(['close']);
const dialog = ref(null);
let previousFocus = null;
watch(() => props.open, async open => {
  if (open) {
    previousFocus = document.activeElement;
    await nextTick();
    dialog.value?.focus();
  } else previousFocus?.focus?.();
}, { immediate: true });
function trapFocus(event) {
  if (!props.open || event.key !== 'Tab' || !dialog.value) return;
  const items = [...dialog.value.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])')]
    .filter(node => node.getClientRects().length);
  if (!items.length) { event.preventDefault(); return; }
  const first = items[0], last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
watch(() => props.open, open => {
  if (open) document.addEventListener('keydown', trapFocus);
  else document.removeEventListener('keydown', trapFocus);
}, { immediate: true });
onUnmounted(() => document.removeEventListener('keydown', trapFocus));
const headingId = 'pmo-compose-heading';
</script>
<style scoped>
.premium-compose-overlay{position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:20px;background:rgba(12,18,29,.56);backdrop-filter:blur(10px)}
.premium-compose-dialog{display:flex;flex-direction:column;width:min(100%,660px);max-height:min(90dvh,900px);overflow:hidden;background:var(--pmo-surface,#fff);border:1px solid var(--pmo-border,#e6e6ea);border-radius:26px;box-shadow:0 32px 100px #08111e50;color:var(--pmo-text,#1d1d1f);outline:none}
.premium-compose-header{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;padding:29px 32px 24px;border-bottom:1px solid var(--pmo-border,#e6e6ea)}
.premium-compose-eyebrow{margin:0 0 9px;font-size:10px;font-weight:800;letter-spacing:.15em;color:var(--pmo-accent,#0071e3)}
.premium-compose-heading h2{font-size:25px;letter-spacing:-.035em;line-height:1.2;margin:0;font-weight:700}
.premium-compose-description{font-size:13px;color:var(--pmo-muted,#6e6e73);line-height:1.6;margin:9px 0 0}
.premium-compose-close{width:38px;height:38px;border:1px solid var(--pmo-border,#e6e6ea);background:var(--pmo-surface-alt,#f5f5f7);color:var(--pmo-muted,#6e6e73);border-radius:13px;display:grid;place-items:center;cursor:pointer;flex:none}
.premium-compose-body{padding:26px 32px;overflow:auto;overscroll-behavior:contain}.premium-compose-error{padding:12px 15px;background:#fce9ed;color:#9b2741;border-radius:12px;font-size:12px}
.premium-compose-body :deep(form){display:grid;gap:15px}
.premium-compose-body :deep(label){display:grid;gap:8px;font-weight:650;font-size:12px;color:var(--pmo-text,#1d1d1f)}
.premium-compose-body :deep(input),.premium-compose-body :deep(textarea){width:100%;border-radius:13px;padding:13px 15px;background:var(--pmo-input,#fff);border:1px solid var(--pmo-border,#e6e6ea);color:var(--pmo-text,#1d1d1f);outline:none;font-size:13px}
.premium-compose-body :deep(input:focus),.premium-compose-body :deep(textarea:focus){border-color:var(--pmo-accent,#0071e3);box-shadow:0 0 0 3px rgba(var(--pmo-accent-rgb,0,113,227),.12)}
.premium-compose-body :deep(form button[type=submit]),.premium-compose-footer :deep(button[type=submit]){min-height:46px;padding:12px 20px;border-radius:13px;background:var(--pmo-accent,#0071e3);color:var(--pmo-on-accent,#fff);border:none;font-size:13px;font-weight:700;cursor:pointer}
.premium-compose-footer{padding:17px 32px 23px;display:flex;justify-content:flex-end;gap:12px;border-top:1px solid var(--pmo-border,#e6e6ea)}
@media(max-width:650px){.premium-compose-overlay{padding:9px}.premium-compose-dialog{max-height:96dvh;border-radius:20px}.premium-compose-header{padding:21px}.premium-compose-body{padding:20px}.premium-compose-footer{padding:16px}}
@media(prefers-reduced-motion:reduce){.premium-compose-overlay{backdrop-filter:none}}
</style>
