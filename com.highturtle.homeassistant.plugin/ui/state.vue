<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center">
          <v-autocomplete
            :items="autocompleteItems"
            :item-props="itemProps"
            item-value="entity_id"
            :model-value="resolvedEntityId"
            v-model:search="entitySearch"
            :label="$t('EntityState.Fields.EntityId.Label')"
            :custom-filter="filterEntity"
            hide-no-data
            @update:model-value="onEntitySelected"
            @update:menu="onEntityMenuToggle"
            :loading="loading"
            :error-messages="error"
            class="flex-grow-1"
          ></v-autocomplete>
          <v-btn
            icon
            size="small"
            :loading="loading"
            @click="fetchEntities(true)"
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
          @update:model-value="onCustomTitleChanged"
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <div class="press-action-section mt-2">
          <div class="v-label mb-2">{{ $t('EntityState.Fields.PressAction.Label') }}</div>
          <v-radio-group
              v-model="modelValue.data.pressAction"
              inline
              hide-details
              @update:model-value="onPressActionChanged"
          >
            <v-radio
                :label="$t('EntityState.Fields.PressAction.None')"
                value="none"
                class="press-action-radio-none"
            ></v-radio>
            <v-radio
                :label="$t('EntityState.Fields.PressAction.On')"
                value="on"
            ></v-radio>
            <v-radio
                :label="$t('EntityState.Fields.PressAction.Off')"
                value="off"
            ></v-radio>
            <v-radio
                :label="$t('EntityState.Fields.PressAction.Toggle')"
                value="toggle"
            ></v-radio>
          </v-radio-group>
          <div
              v-if="modelValue.data.pressAction !== 'none'"
              class="press-action-entity-row d-flex align-center"
          >
            <div class="press-action-entity-spacer flex-shrink-0" aria-hidden="true"></div>
            <div class="press-action-entity-content d-flex align-center flex-grow-1">
              <v-autocomplete
                  :items="triggerAutocompleteItems"
                  :item-props="itemProps"
                  item-value="entity_id"
                  :model-value="resolvedTriggerEntityId"
                  v-model:search="triggerEntitySearch"
                  :label="$t('EntityState.Fields.TriggerEntityId.Label')"
                  :custom-filter="filterEntity"
                  hide-no-data
                  @update:model-value="onTriggerEntitySelected"
                  @update:menu="onTriggerEntityMenuToggle"
                  :loading="loading"
                  :error-messages="error"
                  class="flex-grow-1"
              ></v-autocomplete>
              <v-btn
                  icon
                  size="small"
                  :loading="loading"
                  @click="fetchEntities(true)"
                  :disabled="loading"
                  class="ml-2"
              >
                <v-icon>mdi-refresh</v-icon>
              </v-btn>
            </div>
          </div>
        </div>
      </v-col>
    </v-row>
    <v-row v-if="resolvedEntityId">
      <v-col cols="12">
        <v-alert
          v-if="stateError"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ stateError }}
        </v-alert>
        <v-card>
          <v-card-text>
            <div class="d-flex align-center">
              <div class="text-h6">{{ entityName }}</div>
              <v-spacer></v-spacer>
              <v-btn
                icon
                size="small"
                :loading="stateLoading"
                @click="refreshEntityState"
                :disabled="!resolvedEntityId"
              >
                <v-icon>mdi-refresh</v-icon>
              </v-btn>
            </div>
            <div v-if="entityState !== null" class="text-body-1">
              {{ entityState }}
              <span v-if="entityAttributes?.unit_of_measurement" class="text-caption">
                {{ entityAttributes.unit_of_measurement }}
              </span>
            </div>
            <div v-else-if="!stateLoading && !stateError" class="text-body-2 text-grey">
              {{ $t('EntityState.NoStateAvailable') }}
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
      error: null,
      stateError: null,
      stateFetchId: 0,
      isInitializing: true,
      entitySearch: '',
      triggerEntitySearch: ''
    }
  },
  computed: {
    resolvedEntityId() {
      return this.resolveEntityId(this.modelValue.data.entityId)
    },
    resolvedTriggerEntityId() {
      return this.resolveEntityId(this.modelValue.data.triggerEntityId)
    },
    autocompleteItems() {
      const entityId = this.resolvedEntityId
      if (!entityId || this.entities.some((entity) => entity.entity_id === entityId)) {
        return this.entities
      }

      return [{
        entity_id: entityId,
        state: this.entityState,
        attributes: {
          ...(this.entityAttributes || {}),
          friendly_name: this.entityAttributes?.friendly_name || this.entityName || entityId
        }
      }, ...this.entities]
    },
    triggerAutocompleteItems() {
      const entityId = this.resolvedTriggerEntityId
      if (!entityId || this.entities.some((entity) => entity.entity_id === entityId)) {
        return this.entities
      }

      return [{
        entity_id: entityId,
        state: null,
        attributes: {
          friendly_name: entityId
        }
      }, ...this.entities]
    }
  },
  async created() {
    this.ensureClickableKeyConfig()
    if (!this.modelValue.data.pressAction) {
      this.modelValue.data.pressAction = 'toggle'
    }
    this.syncStoredEntityId()
    this.syncStoredTriggerEntityId()
    await this.fetchEntities()
    if (this.resolvedEntityId) {
      if (!this.applyCachedEntityState()) {
        await this.fetchEntityState(true)
      }
    }
    this.syncEntitySearchToSelection()
    this.syncTriggerEntitySearchToSelection()
    this.isInitializing = false
  },
  methods: {
    ensureClickableKeyConfig() {
      let changed = false

      for (const configKey of ['cfg', 'config']) {
        if (!this.modelValue[configKey]) {
          this.modelValue[configKey] = { keyType: 'default' }
          changed = true
        }

        const keyConfig = this.modelValue[configKey]
        keyConfig.keyType = keyConfig.keyType || 'default'

        if (keyConfig.clickable !== true) {
          keyConfig.clickable = true
          changed = true
        }
        if (keyConfig.sendKey !== false) {
          keyConfig.sendKey = false
          changed = true
        }
      }

      if (changed) {
        this.$emit('update:modelValue', this.modelValue)
      }
    },
    resolveEntityId(entityId) {
      if (entityId == null || entityId === '') return null
      if (typeof entityId === 'object') {
        if (typeof entityId.entity_id === 'string' && entityId.entity_id.trim()) {
          return entityId.entity_id.trim()
        }
        return null
      }
      const id = String(entityId).trim()
      if (!id || id === '[object Object]') return null
      return id
    },
    syncStoredEntityId() {
      const rawEntityId = this.modelValue.data.entityId
      const resolvedEntityId = this.resolveEntityId(rawEntityId)
      if (!resolvedEntityId) {
        if (rawEntityId) {
          this.persistEntityId(null)
          return true
        }
        return false
      }

      if (rawEntityId && typeof rawEntityId === 'object' && rawEntityId.entity_id) {
        this.applyEntityData({
          entity_id: rawEntityId.entity_id,
          state: rawEntityId.state,
          attributes: rawEntityId.attributes
        })
      }

      if (rawEntityId !== resolvedEntityId) {
        this.persistEntityId(resolvedEntityId)
        return true
      }

      return false
    },
    syncStoredTriggerEntityId() {
      const rawEntityId = this.modelValue.data.triggerEntityId
      const resolvedEntityId = this.resolveEntityId(rawEntityId)
      if (!resolvedEntityId) {
        if (rawEntityId) {
          this.persistTriggerEntityId(null)
          return true
        }
        return false
      }

      if (rawEntityId !== resolvedEntityId) {
        this.persistTriggerEntityId(resolvedEntityId)
        return true
      }

      return false
    },
    persistEntityId(entityId) {
      const resolvedEntityId = this.resolveEntityId(entityId)
      if (this.modelValue.data.entityId === (resolvedEntityId || '')) return
      this.modelValue.data.entityId = resolvedEntityId || ''
      this.$emit('update:modelValue', this.modelValue)
    },
    onEntitySelected(value) {
      const nextEntityId = this.resolveEntityId(value)

      if (!nextEntityId) {
        if (this.resolvedEntityId) {
          this.persistEntityId(null)
        }
        return
      }

      if (nextEntityId === this.resolvedEntityId) {
        this.refreshEntityState()
        return
      }

      this.persistEntityId(nextEntityId)
      this.syncEntitySearchToSelection()
    },
    onEntityMenuToggle(isOpen) {
      if (isOpen) {
        this.$nextTick(() => {
          this.entitySearch = ''
        })
        return
      }
      this.syncEntitySearchToSelection()
    },
    getEntityDisplayTitle(entityId) {
      if (!entityId) return ''
      const entity = this.entities.find((item) => item.entity_id === entityId)
        || this.autocompleteItems.find((item) => item.entity_id === entityId)
      return entity?.attributes?.friendly_name || entityId
    },
    syncEntitySearchToSelection() {
      this.entitySearch = this.getEntityDisplayTitle(this.resolvedEntityId)
    },
    syncTriggerEntitySearchToSelection() {
      this.triggerEntitySearch = this.getEntityDisplayTitle(this.resolvedTriggerEntityId)
    },
    persistTriggerEntityId(entityId) {
      const resolvedEntityId = this.resolveEntityId(entityId)
      if (this.modelValue.data.triggerEntityId === (resolvedEntityId || '')) return
      this.modelValue.data.triggerEntityId = resolvedEntityId || ''
      this.$emit('update:modelValue', this.modelValue)
    },
    onTriggerEntitySelected(value) {
      const nextEntityId = this.resolveEntityId(value)

      if (!nextEntityId) {
        if (this.resolvedTriggerEntityId) {
          this.persistTriggerEntityId(null)
        }
        return
      }

      if (nextEntityId === this.resolvedTriggerEntityId) {
        return
      }

      this.persistTriggerEntityId(nextEntityId)
      this.syncTriggerEntitySearchToSelection()
    },
    onTriggerEntityMenuToggle(isOpen) {
      if (isOpen) {
        this.$nextTick(() => {
          this.triggerEntitySearch = ''
        })
        return
      }
      this.syncTriggerEntitySearchToSelection()
    },
    onPressActionChanged() {
      this.$emit('update:modelValue', this.modelValue)
    },
    onCustomTitleChanged() {
      this.updateEntityName()
      this.$emit('update:modelValue', this.modelValue)
    },
    clearEntityState() {
      this.entityState = null
      this.entityAttributes = null
      this.entityName = null
      this.stateError = null
    },
    applyEntityData(entity) {
      if (!entity) return
      this.entityState = entity.state
      this.entityAttributes = entity.attributes || null
      this.updateEntityName(entity)
    },
    updateEntityName(entity = null) {
      const entityId = this.resolvedEntityId
      const attributes = entity?.attributes || this.entityAttributes
      this.entityName = this.modelValue.data.customTitle
        || attributes?.friendly_name
        || entityId
    },
    applyCachedEntityState() {
      const entityId = this.resolvedEntityId
      if (!entityId) return false

      const cachedEntity = this.entities.find((entity) => entity.entity_id === entityId)
      if (cachedEntity) {
        this.applyEntityData(cachedEntity)
        return true
      }

      this.updateEntityName()
      return false
    },
    itemProps(item) {
      return {
        key: item.entity_id,
        title: item.attributes?.friendly_name || item.entity_id,
        subtitle: item.state + (item.attributes?.unit_of_measurement ? ` ${item.attributes.unit_of_measurement}` : '')
      }
    },
    filterEntity(value, query, item) {
      const search = String(query ?? '').toLowerCase()
      if (!search) return true
      const raw = item?.raw || {}
      const entityId = String(raw.entity_id ?? '').toLowerCase()
      const friendlyName = String(raw.attributes?.friendly_name ?? '').toLowerCase()
      return entityId.includes(search) || friendlyName.includes(search)
    },
    async fetchEntities(force = false, { showLoading = true, setFieldError = true } = {}) {
      if (showLoading) {
        this.loading = true
      }
      if (setFieldError) {
        this.error = null
      }
      try {
        const response = force
          ? await this.$fd.sendToBackend('getEntities', { fresh: true })
          : await this.$fd.sendToBackend('getEntities')

        if (response && response.error) {
          if (setFieldError) {
            this.error = this.formatStateError({ message: response.error })
          }
          return false
        }
        this.entities = response
        if (this.resolvedEntityId) {
          this.applyCachedEntityState()
        }
        this.syncEntitySearchToSelection()
        this.syncTriggerEntitySearchToSelection()
        return true
      } catch (error) {
        if (setFieldError) {
          this.error = this.formatStateError(error)
        }
        return false
      } finally {
        if (showLoading) {
          this.loading = false
        }
      }
    },
    formatStateError(error) {
      const message = error?.message || String(error)
      if (message.includes('401')) {
        return this.$t('EntityState.Errors.AuthenticationFailed')
      }
      const lowerMessage = message.toLowerCase()
      if (
        lowerMessage.includes('timeout')
        || lowerMessage.includes('econnrefused')
        || lowerMessage.includes('enotfound')
        || lowerMessage.includes('network')
        || lowerMessage.includes('socket hang up')
      ) {
        return this.$t('EntityState.Errors.ConnectionTimeout')
      }
      if (message.includes('404')) {
        return this.$t('EntityState.Errors.EntityNotFound')
      }
      return message
    },
    async refreshEntityState() {
      const entityId = this.resolvedEntityId
      if (!entityId) return

      const fetchId = ++this.stateFetchId
      this.stateLoading = true
      this.stateError = null

      try {
        const entitiesLoaded = await this.fetchEntities(true, {
          showLoading: false,
          setFieldError: false
        })
        if (fetchId !== this.stateFetchId) return

        if (entitiesLoaded && this.applyCachedEntityState()) {
          return
        }

        await this.fetchEntityState(true, fetchId)
      } catch (error) {
        if (fetchId !== this.stateFetchId) return
        console.error('Error refreshing entity state:', error)
        this.stateError = this.formatStateError(error)
      } finally {
        if (fetchId === this.stateFetchId) {
          this.stateLoading = false
        }
      }
    },
    async fetchEntityState(force = false, existingFetchId = null) {
      const entityId = this.resolvedEntityId
      if (!entityId) return

      if (!force && this.applyCachedEntityState()) {
        this.stateError = null
        return
      }

      const fetchId = existingFetchId ?? ++this.stateFetchId
      if (existingFetchId === null) {
        this.stateLoading = true
        this.stateError = null
      }

      try {
        const response = await this.$fd.sendToBackend('getEntityState', {
          entityId,
          fresh: force
        })

        if (fetchId !== this.stateFetchId) return

        if (response && response.error) {
          this.stateError = this.formatStateError({ message: response.error })
          return
        }

        if (entityId !== this.resolvedEntityId) return

        this.applyEntityData(response)
      } catch (error) {
        if (fetchId !== this.stateFetchId) return
        console.error('Error fetching entity state:', error)
        this.stateError = this.formatStateError(error)
      } finally {
        if (existingFetchId === null && fetchId === this.stateFetchId) {
          this.stateLoading = false
        }
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
      handler() {
        if (this.isInitializing) return

        if (this.syncStoredEntityId()) {
          return
        }

        if (!this.resolvedEntityId) {
          this.stateFetchId++
          this.clearEntityState()
          this.syncEntitySearchToSelection()
          return
        }

        this.stateFetchId++
        this.stateError = null
        this.clearEntityState()

        if (!this.applyCachedEntityState()) {
          this.fetchEntityState(true)
        }
      }
    },
    'modelValue.data.customTitle'() {
      this.updateEntityName()
    },
    'modelValue.data.triggerEntityId': {
      handler() {
        if (this.isInitializing) return
        this.syncStoredTriggerEntityId()
        this.syncTriggerEntitySearchToSelection()
      }
    }
  }
}
</script>

<style scoped>
.press-action-section {
  --press-action-none-width: 128px;
}

.press-action-radio-none {
  width: var(--press-action-none-width);
}

.press-action-entity-spacer {
  width: var(--press-action-none-width);
}

.press-action-entity-row,
.press-action-entity-content {
  min-width: 0;
}
</style>
