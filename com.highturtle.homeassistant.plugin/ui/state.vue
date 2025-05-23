<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center">
          <v-select
            :items="entities"
            :item-props="itemProps"
            v-model="modelValue.data.entityId"
            :label="$t('EntityState.Fields.EntityId.Label')"
            @update:model-value="$emit('update:modelValue', modelValue)"
            :loading="loading"
            :error-messages="error"
            class="flex-grow-1"
          ></v-select>
          <v-btn
            icon
            size="small"
            :loading="loading"
            @click="fetchEntities"
            :disabled="loading"
            class="ml-2"
          >
            <v-icon>mdi-refresh</v-icon>
          </v-btn>
        </div>
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
            <div class="d-flex align-center">
              <div class="text-h6">{{ entityName }}</div>
              <v-spacer></v-spacer>
              <v-btn
                icon
                size="small"
                :loading="stateLoading"
                @click="fetchEntityState"
                :disabled="!modelValue.data.entityId"
              >
                <v-icon>mdi-refresh</v-icon>
              </v-btn>
            </div>
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
      entityName: null,
      loading: false,
      stateLoading: false,
      error: null
    }
  },
  async created() {
    await this.fetchEntities()
    if (this.modelValue.data.entityId) {
      await this.fetchEntityState()
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
    async fetchEntities() {
      this.loading = true
      this.error = null
      try {
        const response = await this.$fd.sendToBackend('getEntities')


        if (response && response.error) {
          this.error = response.error
          this.entities = []
          return
        }
        this.entities = response
      } catch (error) {
        this.error = error.message || String(error)
        this.entities = []
      } finally {
        this.loading = false
      }
    },
    async fetchEntityState() {
      this.stateLoading = true
      try {
        const response = await this.$fd.sendToBackend('getEntityState', {
          entityId: this.modelValue.data.entityId
        })
        this.entityState = response.state
        this.entityAttributes = response.attributes
        this.entityName = this.modelValue.data.customTitle || response.attributes?.friendly_name || this.modelValue.data.entityId
      } catch (error) {
        console.error('Error fetching entity state:', error)
        let message = error.message || String(error)
        let hint = ''
        if (message.includes('401')) {
          hint = '\nAuthentication Failed: Please check your API key in the plugin settings.'
        } else if (message.toLowerCase().includes('timeout')) {
          hint = '\nConnection Timeout: Please check your Home Assistant URL and network connection.'
        }
        this.entityState = message + hint
        this.entityAttributes = null
      } finally {
        this.stateLoading = false
      }
    },
    formatAttributes(attributes) {
      if (!attributes) return ''
      const { friendly_name, unit_of_measurement, ...otherAttrs } = attributes
      return Object.entries(otherAttrs)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ')
    }
  },
  watch: {
    'modelValue.data.entityId': {
      handler(newValue) {
        if (newValue) {
          this.fetchEntityState()
        }
      }
    }
  }
}
</script>

<style scoped>

</style> 