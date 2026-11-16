<template>
  <div ref="root" class="smart-select" :class="{ disabled }">
    <button :id="id" type="button" class="smart-trigger" :disabled="disabled"
      role="combobox" aria-haspopup="listbox" :aria-expanded="open"
      :aria-controls="listId" :aria-label="ariaLabel || undefined"
      @click="open = !open" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="open = !open" @keydown.esc="open = false">
      <span>{{ selected?.label || placeholder }}</span><span class="smart-chevron" aria-hidden="true">⌄</span>
    </button>
    <div v-if="open" :id="listId" class="smart-menu" role="listbox" :aria-label="ariaLabel || 'Choose option'">
      <button v-for="(option,index) in normalized" :key="option.value" type="button" role="option"
        :aria-selected="modelValue === option.value" :class="{ selected: modelValue === option.value }"
        @click="choose(option.value)">
        {{ option.label }} <span v-if="modelValue === option.value" aria-hidden="true">✓</span>
      </button>
    </div>
  </div>
</template>
<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
const props=defineProps({ modelValue:{type:[String,Number],default:''}, options:{type:Array,required:true}, id:String, ariaLabel:String, disabled:Boolean, placeholder:{type:String,default:'Select an option'} });
const emit=defineEmits(['update:modelValue','change']);
const root=ref(null),open=ref(false);
const normalized=computed(()=>props.options.map(option=>typeof option==='string'?{value:option,label:option}:{value:option.value,label:option.label}));
const selected=computed(()=>normalized.value.find(option=>option.value===props.modelValue));
const listId='smart-list-'+Math.random().toString(36).slice(2);
function choose(value){emit('update:modelValue',value);emit('change',value);open.value=false;root.value?.querySelector('.smart-trigger')?.focus();}
function move(direction){if(props.disabled)return;const index=normalized.value.findIndex(option=>option.value===props.modelValue);const next=(index+direction+normalized.value.length)%normalized.value.length;if(normalized.value.length)choose(normalized.value[next].value);}
function outside(event){if(root.value&&!root.value.contains(event.target))open.value=false;}
function onKey(event){if(event.key==='Escape')open.value=false;}
onMounted(()=>{document.addEventListener('pointerdown',outside);document.addEventListener('keydown',onKey);});
onUnmounted(()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',onKey);});
</script>
<style scoped>
.smart-select{position:relative;min-width:0;width:100%}
.smart-trigger{min-height:43px;width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;padding:10px 13px;border:1px solid #d8e0ec;border-radius:11px;background:#fff;color:#263958;font-size:13px;cursor:pointer}
.smart-trigger:focus-visible{outline:3px solid #99b6ef;outline-offset:2px}
.smart-chevron{font-size:20px;color:#70819a}
.smart-menu{position:absolute;z-index:100;left:0;right:0;top:calc(100% + 5px);background:#fff;border:1px solid #dce5f2;border-radius:12px;padding:6px;box-shadow:0 16px 35px #17284b26;max-height:235px;overflow-y:auto}
.smart-menu button{display:flex;align-items:center;justify-content:space-between;text-align:left;width:100%;border:0;border-radius:8px;padding:11px 12px;background:transparent;color:#263958;font-size:13px;cursor:pointer}
.smart-menu button:hover,.smart-menu button.selected{background:#eef3ff;color:#315ac4}
.disabled{opacity:.6}
</style>