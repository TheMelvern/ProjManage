<template>
  <div ref="root" class="date-select" :class="{disabled}">
    <button :id="id" type="button" class="date-trigger" :disabled="disabled" :aria-label="ariaLabel || 'Choose date'" :aria-expanded="open" aria-haspopup="dialog" @keydown.esc="escapeTrigger" @click="toggle">
      <span>{{ formatted }}</span><span class="material-symbols-outlined" aria-hidden="true">calendar_month</span>
    </button>
    <div v-if="open" class="date-popover" @keydown.esc.stop.prevent="close" role="dialog" :aria-label="ariaLabel || 'Date picker'">
      <div class="calendar-heading">
        <button type="button" aria-label="Previous month" @click="shift(-1)">‹</button>
        <strong>{{ monthName }}</strong>
        <button type="button" aria-label="Next month" @click="shift(1)">›</button>
      </div>
      <div class="calendar-grid">
        <span v-for="(day,index) in ['M','T','W','T','F','S','S']" :key="index" class="weekday">{{day}}</span>
        <button v-for="date in cells" :key="date.key" type="button"
          :disabled="!date.current || (min && date.key < min) || (max && date.key > max)"
          :aria-label="date.label" :data-date="date.key" :tabindex="focusedDate === date.key ? 0 : -1" @keydown="moveDay($event, date.key)" :aria-pressed="modelValue===date.key" :class="{selected:modelValue===date.key,today:date.key===today}" @click="pick(date.key)">
          {{date.day}}
        </button>
      </div>
      <div class="date-footer">
        <button type="button" @click="pick('')" :disabled="required">Clear</button>
        <button type="button" @click="pick(today)" :disabled="(min && today<min)||(max && today>max)">Today</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
const props=defineProps({modelValue:{type:String,default:''},id:String,ariaLabel:String,min:String,max:String,disabled:Boolean,required:Boolean});
const emit=defineEmits(['update:modelValue','change']);
const root=ref(null),open=ref(false),focusedDate=ref('');
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const today=iso(new Date());
const initial=props.modelValue&&/^\d{4}-\d{2}-\d{2}$/.test(props.modelValue)?props.modelValue:today;
const view=ref(new Date(initial+'T12:00:00'));
const monthName=computed(()=>view.value.toLocaleDateString('en-GB',{month:'long',year:'numeric'}));
const formatted=computed(()=>props.modelValue?new Date(props.modelValue+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'Select date');
const cells=computed(()=>{const y=view.value.getFullYear(),m=view.value.getMonth();const first=new Date(y,m,1);const start=(first.getDay()+6)%7;return Array.from({length:42},(_,i)=>{const d=new Date(y,m,1-start+i);return {key:iso(d),day:d.getDate(),current:d.getMonth()===m,label:d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})};});});
function focusDate(date) {
  focusedDate.value = date;
  nextTick(() => root.value?.querySelector('[data-date="' + date + '"]')?.focus());
}
function bounded(date) {
  if (props.min && date < props.min) return props.min;
  if (props.max && date > props.max) return props.max;
  return date;
}
function shift(n) {
  view.value = new Date(view.value.getFullYear(), view.value.getMonth() + n, 1);
  focusedDate.value = cells.value.find(date => date.current && bounded(date.key) === date.key)?.key || '';
}
function close() {
  open.value = false;
  root.value?.querySelector('.date-trigger')?.focus();
}
function escapeTrigger(event) {
  if (!open.value) return;
  event.stopPropagation();
  event.preventDefault();
  close();
}
function toggle() {
  if (open.value) { close(); return; }
  const date = bounded(props.modelValue || today);
  view.value = new Date(date + 'T12:00:00');
  open.value = true;
  focusDate(date);
}
function moveDay(event, date) {
  const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
  if (!offset) return;
  event.preventDefault();
  const next = new Date(date + 'T12:00:00');
  next.setDate(next.getDate() + offset);
  const key = bounded(iso(next));
  view.value = new Date(key + 'T12:00:00');
  focusDate(key);
}
function pick(date){if(date&&((props.min&&date<props.min)||(props.max&&date>props.max)))return;emit('update:modelValue',date);emit('change',date);open.value=false;root.value?.querySelector('.date-trigger')?.focus();}
function outside(e){if(root.value&&!root.value.contains(e.target))open.value=false;}
onMounted(() => document.addEventListener('pointerdown', outside));
onUnmounted(() => document.removeEventListener('pointerdown', outside));
watch(()=>props.modelValue,v=>{if(v&&/^\d{4}-\d{2}-\d{2}$/.test(v))view.value=new Date(v+'T12:00:00');});
</script>
<style scoped>
.date-select{position:relative;min-width:0;width:100%}.date-select.disabled{opacity:.6}
.date-trigger{display:flex;align-items:center;justify-content:space-between;text-align:left;gap:10px;min-height:44px;width:100%;background:#fff;border:1px solid var(--pmo-border);border-radius:11px;color:var(--pmo-text);padding:10px 13px;cursor:pointer;font:inherit;font-size:13px}
.date-trigger .material-symbols-outlined{font-size:18px;color:var(--pmo-accent-ink)}.date-trigger:focus-visible,.date-popover button:focus-visible{outline:3px solid var(--pmo-accent-ink);outline-offset:2px}
.date-popover{position:absolute;z-index:180;top:calc(100% + 6px);left:0;width:min(310px,calc(100vw - 35px));padding:14px;background:white;border:1px solid var(--pmo-border);border-radius:15px;box-shadow:0 18px 45px color-mix(in srgb, var(--pmo-accent) 17%, transparent);color:var(--pmo-text)}
.calendar-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.calendar-heading strong{font-size:13px}.calendar-heading button{font-size:21px}
.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px}.calendar-grid .weekday{text-align:center;color:#7789a1;font-size:11px;padding:8px 0}.calendar-grid button{font-size:12px}
.date-popover button{border:0;background:none;border-radius:8px;min-height:35px;cursor:pointer;color:inherit}.calendar-grid button:hover:not(:disabled){background:var(--pmo-accent-soft)}.calendar-grid button.selected{background:var(--pmo-accent);color:var(--pmo-on-accent)}.calendar-grid button.today:not(.selected){box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--pmo-accent) 18%, transparent)}.calendar-grid button:disabled{color:#c5cfdd;cursor:default}
.date-footer{display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid var(--pmo-border)}.date-footer button{font-size:12px;color:var(--pmo-accent-ink);font-weight:700}
</style>