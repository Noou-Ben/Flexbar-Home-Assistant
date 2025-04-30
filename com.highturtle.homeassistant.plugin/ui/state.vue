<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-select
          :items="entities"
          :item-props="itemProps"
          v-model="modelValue.data.entityId"
          :label="$t('EntityState.Fields.EntityId.Label')"
          @update:model-value="$emit('update:modelValue', modelValue)"
        ></v-select>
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
    <v-row v-if="modelValue.data.entityId">
      <v-col cols="12">
        <v-card>
          <v-card-text>
            <div class="text-h6">{{ entityName }}</div>
            <div class="text-body-1">
              {{ entityState }}
              <span v-if="entityAttributes?.unit_of_measurement" class="text-caption">
                {{ entityAttributes.unit_of_measurement }}
              </span>
            </div>
            <div v-if="entityAttributes" class="text-caption text-grey">
              {{ formatAttributes(entityAttributes) }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: 'StateConfig',
  props: {
    modelValue: {
      type: Object,
      required: true
    }
  },
  emits: ['update:modelValue'],
  data() {
    return {
      entities: [],
      entityState: null,
      entityAttributes: null,
      entityName: null
    }
  },
  async created() {
    try {
      const response = await this.$fd.sendToBackend('getEntities')
      this.entities = response
      if (this.modelValue.data.entityId) {
        await this.fetchEntityState()
      }
    } catch (error) {
      console.error('Error fetching entities:', error)
    }
  },
  methods: {
    itemProps(item) {
      return {
        key: item.entity_id,
        title: item.attributes?.friendly_name || item.entity_id,
        subtitle: item.state + (item.attributes?.unit_of_measurement ? ` ${item.attributes.unit_of_measurement}` : '')
      }
    },
    async fetchEntityState() {
      try {
        const response = await this.$fd.sendToBackend('getEntityState', {
          entityId: this.modelValue.data.entityId
        })
        this.entityState = response.state
        this.entityAttributes = response.attributes
        this.entityName = this.modelValue.data.customTitle || response.attributes?.friendly_name || this.modelValue.data.entityId
      } catch (error) {
        console.error('Error fetching entity state:', error)
      }
    },
    formatAttributes(attributes) {
      if (!attributes) return ''
      const { friendly_name, unit_of_measurement, ...otherAttrs } = attributes
      return Object.entries(otherAttrs)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ')
    }
  }
}
</script>

<style scoped>

</style> 