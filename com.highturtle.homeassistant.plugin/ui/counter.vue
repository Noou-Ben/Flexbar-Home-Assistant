
<template>
  <v-container>
    <v-row>
      <v-col cols="6">
        <v-text-field v-model="modelValue.data.rangeMin" :label="$t('Counter.UI.RangeMin')" type="number" hide-details
          outlined class="mx-2"></v-text-field>
      </v-col>
      <v-col cols="6">
        <v-text-field v-model="modelValue.data.rangeMax" :label="$t('Counter.UI.RangeMax')" type="number" hide-details
          outlined class="mx-2"></v-text-field>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
  },
  emits: ['update:modelValue'],
  data() {
    return {
    };
  },
  methods: {
  },
  mounted() {
    this.$fd.info("Hello from Counter Plugin");
  }
};
</script>

<style scoped></style>
