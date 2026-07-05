<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center">
          <v-autocomplete
            :items="autocompleteItems"
            :item-props="itemProps"
            item-value="entity_id"
            :model-value="entityMenuOpen ? null : resolvedEntityId"
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
      entityMenuOpen: false
    }
  },
  computed: {
    resolvedEntityId() {
      return this.resolveEntityId(this.modelValue.data.entityId)
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
    }
  },
  async created() {
    this.syncStoredEntityId()
    await this.fetchEntities()
    if (this.resolvedEntityId) {
      if (!this.applyCachedEntityState()) {
        await this.fetchEntityState(true)
      }
    }
    this.isInitializing = false
  },
  methods: {
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
      this.entitySearch = ''
    },
    onEntityMenuToggle(isOpen) {
      this.entityMenuOpen = isOpen
      if (isOpen) {
        this.$nextTick(() => {
          this.entitySearch = ''
        })
        return
      }
      this.entitySearch = ''
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
    }
  }
}
</script>
