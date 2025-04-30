<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-text-field
          v-model="modelValue.data.domain"
          :label="$t('ServiceCall.Fields.Domain.Label')"
          :placeholder="$t('ServiceCall.Fields.Domain.Placeholder')"
          @update:model-value="$emit('update:modelValue', modelValue)"
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-text-field
          v-model="modelValue.data.service"
          :label="$t('ServiceCall.Fields.Service.Label')"
          :placeholder="$t('ServiceCall.Fields.Service.Placeholder')"
          @update:model-value="$emit('update:modelValue', modelValue)"
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-textarea
          v-model="modelValue.data.serviceData"
          :label="$t('ServiceCall.Fields.ServiceData.Label')"
          :placeholder="$t('ServiceCall.Fields.ServiceData.Placeholder')"
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
  name: 'ServiceConfig',
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