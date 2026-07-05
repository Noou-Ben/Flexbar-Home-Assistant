const { plugin, logger, pluginPath, resourcesPath } = require("@eniac/flexdesigner")
const https = require('https')
const http = require('http')

const DEFAULT_TIMEOUT_MS = 15000
const BULK_TIMEOUT_MS = 60000
const ENTITIES_CACHE_TTL_MS = 30000
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1000

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 5 })
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 5 })

const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN'
])

// Store key data
const keyData = {}
const refreshIntervals = {}

function normalizeEntityId(entityId) {
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
}

function isRetryableError(error) {
  if (!error) return false
  if (RETRYABLE_ERROR_CODES.has(error.code)) return true
  const message = (error.message || '').toLowerCase()
  return message.includes('timeout')
    || message.includes('socket hang up')
    || message.includes('network')
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withRetry(operation, label) {
  let lastError
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === MAX_RETRIES || !isRetryableError(error)) {
        throw error
      }
      const retryDelay = RETRY_BASE_DELAY_MS * attempt
      logger.warn(`${label} failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${retryDelay}ms:`, error.message)
      await delay(retryDelay)
    }
  }
  throw lastError
}

class HomeAssistantPlugin {
  constructor() {
    this.config = null
    this.useMockData = false
    this.initialized = false
    this.entitiesCache = null
    this.entitiesCacheTime = 0
    this.entitiesRequest = null
  }

  async init() {
    try {
      // Load configuration
      this.config = await plugin.getConfig()
      if (!this.config || !this.config.url || !this.config.apiKey) {
        console.error('Home Assistant configuration is missing')
        throw new Error('Home Assistant configuration is missing')
      }
      this.useMockData = false
      this.initialized = true
      logger.info('Home Assistant plugin initialized with config:', this.config)
    } catch (error) {
      logger.error('Failed to initialize Home Assistant plugin:', error)
      throw error
    }
  }

  async makeRequest(path, method = 'GET', data = null, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
    if (!this.initialized) {
      throw new Error('Home Assistant plugin not initialized. Please check configuration.')
    }

    const url = new URL(path, this.config.url)
    const protocol = url.protocol === 'https:' ? 'https' : 'http'
    logger.info('Making request to:', url.toString())

    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (callback, value) => {
        if (settled) return
        settled = true
        callback(value)
      }

      const options = {
        method,
        timeout,
        agent: protocol === 'https' ? httpsAgent : httpAgent,
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        }
      }

      const client = protocol === 'https' ? https : http
      const req = client.request(url, options, (res) => {
        let responseData = ''

        res.on('data', (chunk) => {
          responseData += chunk
        })

        res.on('end', () => {
          try {
            if (res.statusCode >= 400) {
              let errorMessage = `HTTP ${res.statusCode}: ${res.statusMessage}`
              try {
                const parsedData = JSON.parse(responseData)
                errorMessage = parsedData.message || errorMessage
              } catch (e) {
                if (responseData) {
                  errorMessage = responseData
                }
              }
              finish(reject, new Error(errorMessage))
              return
            }

            if (!responseData) {
              finish(resolve, null)
              return
            }

            finish(resolve, JSON.parse(responseData))
          } catch (error) {
            logger.error('Error parsing response:', error)
            finish(reject, new Error(responseData || error.message))
          }
        })
      })

      req.on('timeout', () => {
        req.destroy(new Error('Connection timeout: Home Assistant did not respond in time'))
      })

      req.on('error', (error) => {
        logger.error('Request error:', error)
        if (error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
          finish(reject, new Error('Connection timeout: Home Assistant did not respond in time'))
          return
        }
        finish(reject, error)
      })

      if (data) {
        req.write(JSON.stringify(data))
      }

      req.end()
    })
  }

  getCachedEntity(entityId) {
    if (!this.entitiesCache || Date.now() - this.entitiesCacheTime > ENTITIES_CACHE_TTL_MS) {
      return null
    }
    return this.entitiesCache.get(entityId) || null
  }

  setEntitiesCache(entities) {
    this.entitiesCache = new Map(entities.map((entity) => [entity.entity_id, entity]))
    this.entitiesCacheTime = Date.now()
  }

  updateEntityCache(entityId, entity) {
    if (!entity) return
    if (!this.entitiesCache) {
      this.entitiesCache = new Map()
    }
    this.entitiesCache.set(entityId, entity)
    this.entitiesCacheTime = Date.now()
  }

  async getEntityState({ entityId, fresh = false }) {
    try {
      if (!this.initialized) {
        throw new Error('Home Assistant plugin not initialized')
      }
      const normalizedEntityId = normalizeEntityId(entityId)
      if (!normalizedEntityId) {
        throw new Error('Entity ID is required')
      }

      if (!fresh) {
        const cachedEntity = this.getCachedEntity(normalizedEntityId)
        if (cachedEntity) {
          logger.info('Returning cached state for entity:', normalizedEntityId)
          return cachedEntity
        }
      }

      logger.info('Fetching state for entity:', normalizedEntityId)
      const entity = await withRetry(
        () => this.makeRequest(`/api/states/${encodeURIComponent(normalizedEntityId)}`),
        `getEntityState(${normalizedEntityId})`
      )
      this.updateEntityCache(normalizedEntityId, entity)
      return entity
    } catch (error) {
      logger.error('Error fetching entity state:', error)
      throw error
    }
  }

  async getEntities({ fresh = false } = {}) {
    logger.info('Fetching entities', fresh ? '(fresh)' : '')
    try {
      if (!this.initialized) {
        throw new Error('Home Assistant plugin not initialized')
      }

      if (!fresh && this.entitiesCache && Date.now() - this.entitiesCacheTime <= ENTITIES_CACHE_TTL_MS) {
        logger.info('Returning cached entities list')
        return Array.from(this.entitiesCache.values())
      }

      if (this.entitiesRequest) {
        return await this.entitiesRequest
      }

      this.entitiesRequest = withRetry(
        () => this.makeRequest('/api/states', 'GET', null, { timeout: BULK_TIMEOUT_MS }),
        'getEntities'
      ).then((entities) => {
        this.setEntitiesCache(entities)
        return entities
      }).finally(() => {
        this.entitiesRequest = null
      })

      return await this.entitiesRequest
    } catch (error) {
      logger.error('Error fetching entities:', error)
      throw error
    }
  }

  async onConfigUpdate(newConfig) {
    this.config = newConfig
    if (!this.config || !this.config.url || !this.config.apiKey) {
      throw new Error('Home Assistant configuration is missing')
    }
    this.useMockData = false
    this.initialized = true
    this.entitiesCache = null
    this.entitiesCacheTime = 0
    this.entitiesRequest = null
  }

  async callService({ domain, service, serviceData }) {
    try {
      if (!this.initialized) {
        throw new Error('Home Assistant plugin not initialized')
      }
      logger.info('Calling service:', { domain, service, serviceData })
      return await withRetry(
        () => this.makeRequest(`/api/services/${domain}/${service}`, 'POST', serviceData),
        `callService(${domain}.${service})`
      )
    } catch (error) {
      logger.error('Error calling service:', error)
      throw error
    }
  }

  async triggerEvent({ eventType, eventData }) {
    try {
      if (!this.initialized) {
        throw new Error('Home Assistant plugin not initialized')
      }
      logger.info('Triggering event:', { eventType, eventData })
      return await withRetry(
        () => this.makeRequest(`/api/events/${eventType}`, 'POST', eventData),
        `triggerEvent(${eventType})`
      )
    } catch (error) {
      logger.error('Error triggering event:', error)
      throw error
    }
  }
}

const haPlugin = new HomeAssistantPlugin()

/**
 * Called when current active window changes
 * {
 *    "status": "changed",
 *    "oldWin": OldWindow,
 *    "newWin": NewWindow
 * }
 */
plugin.on('system.actwin', (payload) => {
  logger.info('Active window changed:', payload)
})

/**
 * Called when received message from UI send by this.$fd.sendToBackend
 * @param {object} payload message sent from UI
 */
plugin.on('ui.message', async (payload) => {
  logger.info('Received message from UI:', payload)
  try {
    if (!haPlugin.initialized) {
      await haPlugin.init()
    }
    if (payload === 'getEntities' || payload?.method === 'getEntities') {
      return await haPlugin.getEntities({ fresh: Boolean(payload?.fresh) })
    }
    if (payload?.method === 'getEntityState') {
      return await haPlugin.getEntityState({
        entityId: payload.entityId,
        fresh: Boolean(payload.fresh)
      })
    }
    if (payload.method === 'callService') {
      return await haPlugin.callService(payload)
    }
    if (payload.method === 'triggerEvent') {
      return await haPlugin.triggerEvent(payload)
    }
    return 'Hello from plugin backend!'
  } catch (error) {
    logger.error('Error handling UI message:', error)
    // Instead of throwing, return the error as a value
    return { error: error.message || String(error) }
  }
})

/**
 * Called when device status changes
 * @param {object} devices device status data
 * [
 *  {
 *    serialNumber: '',
 *    deviceData: {
 *       platform: '',
 *       profileVersion: '',
 *       firmwareVersion: '',
 *       deviceName: '',
 *       displayName: ''
 *    }
 *  }
 * ]
 */
plugin.on('device.status', (devices) => {
  logger.info('Device status changed:', devices)
})

/**
 * Called when a plugin key is loaded
 * @param {Object} payload alive key data
 * {
 *  serialNumber: '',
 *  keys: []
 * }
 */
plugin.on('plugin.alive', async (payload) => {
  logger.info('Plugin alive:', payload)
  try {
    await haPlugin.init()
    for (let key of payload.keys) {
      keyData[key.uid] = key
      if (key.cid === 'com.highturtle.homeassistant.state') {
        // Don't render immediately, wait for the key to be fully alive
        setTimeout(() => renderKey(payload.serialNumber, key), 1000)
      }
    }
  } catch (error) {
    logger.error('Failed to initialize plugin:', error)
  }
})

/**
 * Called when user interacts with a key
 * @param {object} payload key data 
 * {
 *  serialNumber, 
 *  data
 * }
 */
plugin.on('plugin.data', async (payload) => {
  logger.info('Received plugin.data:', payload)
  const data = payload.data
  if (data.key.cid === "com.highturtle.homeassistant.state") {
    const key = data.key
    // Don't render immediately, wait for the key to be fully alive
    setTimeout(() => renderKey(payload.serialNumber, key), 1000)
  }
})

// Add cleanup for removed keys
plugin.on('plugin.removed', (payload) => {
  logger.info('Plugin removed:', payload)
  if (payload.key && refreshIntervals[payload.key.uid]) {
    clearInterval(refreshIntervals[payload.key.uid])
    delete refreshIntervals[payload.key.uid]
  }
})

async function renderKey(serialNumber, key) {
  try {
    if (key.cid === 'com.highturtle.homeassistant.state') {
      const entityId = key.data?.entityId
      const customTitle = key.data?.customTitle
      const refreshInterval = key.data?.refreshInterval || 10000 // Default to 10 seconds

      if (!entityId) {
        key.style.showIcon = true
        key.style.showTitle = true
        key.title = 'Select an entity'
        key.style.icon = 'mdi mdi-information'
        plugin.draw(serialNumber, key, 'draw')
        return
      }

      const actualEntityId = normalizeEntityId(entityId)

      // Clear any existing interval for this key
      if (refreshIntervals[key.uid]) {
        clearInterval(refreshIntervals[key.uid])
      }

      // Function to update the key state
      const updateKeyState = async () => {
        try {
          const entity = await haPlugin.getEntityState({ entityId: actualEntityId, fresh: true })
          const displayName = customTitle || entity.attributes?.friendly_name || actualEntityId
          const state = entity.state
          const unit = entity.attributes?.unit_of_measurement || ''

          key.style.showIcon = true
          key.style.showTitle = true
          key.title = `${displayName}\n${state}${unit ? ' ' + unit : ''}`
          plugin.draw(serialNumber, key, 'draw')
        } catch (error) {
          logger.error('Error fetching entity state:', error)
          key.style.showIcon = true
          key.style.showTitle = true

          // Handle different types of errors
          let errorMessage = 'Error'
          if (error.message.includes('401')) {
            errorMessage = 'Authentication Failed\nCheck API Key'
            key.style.icon = 'mdi mdi-key-remove'
          } else if (error.message.includes('404')) {
            errorMessage = 'Entity Not Found'
            key.style.icon = 'mdi mdi-alert'
          } else if (error.message.toLowerCase().includes('timeout')) {
            errorMessage = 'Connection Timeout'
            key.style.icon = 'mdi mdi-wifi-off'
          } else {
            errorMessage = error.message
            key.style.icon = 'mdi mdi-alert'
          }

          key.title = `${actualEntityId}\n${errorMessage}`
          plugin.draw(serialNumber, key, 'draw')
        }
      }

      // Initial update
      await updateKeyState()

      // Set up interval for future updates
      refreshIntervals[key.uid] = setInterval(updateKeyState, refreshInterval)
    } else if (key.cid === 'com.highturtle.homeassistant.service') {
      const { domain, service, customTitle } = key.data
      if (!domain || !service) {
        key.style.showIcon = true
        key.style.showTitle = true
        key.title = 'Configure service'
        key.style.icon = 'mdi mdi-information'
        plugin.draw(serialNumber, key, 'draw')
        return
      }

      key.style.showIcon = true
      key.style.showTitle = true
      key.title = customTitle || `${domain}.${service}`
    } else if (key.cid === 'com.highturtle.homeassistant.event') {
      const { eventType, customTitle } = key.data
      if (!eventType) {
        key.style.showIcon = true
        key.style.showTitle = true
        key.title = 'Configure event'
        key.style.icon = 'mdi mdi-information'
        plugin.draw(serialNumber, key, 'draw')
        return
      }

      key.style.showIcon = true
      key.style.showTitle = true
      key.title = customTitle || eventType
    }
    plugin.draw(serialNumber, key, 'draw')
  } catch (error) {
    logger.error('Error rendering key:', error)
    key.style.showIcon = true
    key.style.showTitle = true
    key.title = 'Error'
    key.style.icon = 'mdi mdi-alert'
    plugin.draw(serialNumber, key, 'draw')
  }
}

module.exports = HomeAssistantPlugin

// Connect to flexdesigner and start the plugin
plugin.start()
