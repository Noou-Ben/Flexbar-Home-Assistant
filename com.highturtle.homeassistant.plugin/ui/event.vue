<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-text-field
          v-model="modelValue.data.eventType"
          :label="$t('EventTrigger.Fields.EventType.Label')"
          :placeholder="$t('EventTrigger.Fields.EventType.Placeholder')"
          @update:model-value="$emit('update:modelValue', modelValue)"
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-textarea
          v-model="modelValue.data.eventData"
          :label="$t('EventTrigger.Fields.EventData.Label')"
          :placeholder="$t('EventTrigger.Fields.EventData.Placeholder')"
          @update:model-value="$emit('update:modelValue', modelValue)"
          rows="3"
        ></v-textarea>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-text-field
          v-model="modelValue.data.customTitle"
          :label="$t('CustomTitle')"
          :hint="$t('CustomTitleDesc')"
          persistent-hint
          @update:model-value="$emit('update:modelValue', modelValue)"
        ></v-text-field>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: 'EventConfig',
  props: {
    modelValue: {
      type: Object,
      required: true
    }
  },
  emits: ['update:modelValue']
}
</script>

<style scoped>
</style> 