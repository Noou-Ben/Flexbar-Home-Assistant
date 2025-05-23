const { plugin, logger, pluginPath, resourcesPath } = require("@eniac/flexdesigner")
const https = require('https')
const http = require('http')

// Store key data
const keyData = {}
const refreshIntervals = {}

class HomeAssistantPlugin {
  constructor() {
    this.config = null
    this.useMockData = false
    this.initialized = false
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

  async makeRequest(path, method = 'GET', data = null) {
    logger.info('Making request to:', path)
    logger.info('Initialized:', this.initialized)
    console.log('Making request to:', path)
    console.log('Initialized:', this.initialized)
    if (!this.initialized) {
      throw new Error('Home Assistant plugin not initialized. Please check configuration.')
    }

    return new Promise((resolve, reject) => {
      const url = new URL(path, this.config.url)
      logger.info('Making request to:', url.toString())
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }

      if (data) {
        options.body = JSON.stringify(data)
      }

      const makeHttpRequest = (protocol) => {
        return new Promise((resolveHttp, rejectHttp) => {
          const client = protocol === 'https' ? https : http
          const req = client.request(url, options, (res) => {
            let responseData = ''
            
            res.on('data', (chunk) => {
              responseData += chunk
            })

            res.on('end', () => {
              try {
                logger.info('Raw response data:', responseData)
                
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
                  rejectHttp(new Error(errorMessage))
                  return
                }

                if (!responseData) {
                  resolveHttp(null)
                  return
                }

                const parsedData = JSON.parse(responseData)
                logger.info('Response data:', parsedData)
                resolveHttp(parsedData)
              } catch (error) {
                logger.error('Error parsing response:', error)
                logger.error('Response data that failed to parse:', responseData)
                rejectHttp(new Error(responseData || error.message))
              }
            })
          })

          req.on('error', (error) => {
            logger.error('Request error:', error)
            rejectHttp(error)
          })

          if (data) {
            req.write(JSON.stringify(data))
          }

          req.end()
        })
      }

      // Try HTTPS first, then fall back to HTTP if it fails
      makeHttpRequest('https')
        .then(resolve)
        .catch((httpsError) => {
          logger.info('HTTPS request failed, trying HTTP:', httpsError.message)
          makeHttpRequest('http')
            .then(resolve)
            .catch((httpError) => {
              logger.error('Both HTTPS and HTTP requests failed')
              reject(new Error(`Failed to connect: ${httpError.message}`))
            })
        })
    })
  }

  async getEntityState({ entityId }) {
    try {
      if (!this.initialized) {
        throw new Error('Home Assistant plugin not initialized')
      }
      logger.info('Fetching state for entity:', entityId)
      return await this.makeRequest(`/api/states/${entityId}`)
    } catch (error) {
      logger.error('Error fetching entity state:', error)
      throw error
    }
  }

  async getEntities() {
    logger.info('Fetching entities')
    console.log('Fetching entities cl')
    try {
      if (!this.initialized) {
        throw new Error('Home Assistant plugin not initialized')
      }
      return await this.makeRequest('/api/states')
    } catch (error) {
      console.error('Error fetching entities:', error)
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
  }

  async callService({ domain, service, serviceData }) {
    try {
      if (!this.initialized) {
        throw new Error('Home Assistant plugin not initialized')
      }
      logger.info('Calling service:', { domain, service, serviceData })
      return await this.makeRequest(`/api/services/${domain}/${service}`, 'POST', serviceData)
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
      return await this.makeRequest(`/api/events/${eventType}`, 'POST', eventData)
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
        if (payload === 'getEntities') {
            return await haPlugin.getEntities()
        }
        if (payload.method === 'getEntityState') {
            return await haPlugin.getEntityState({ entityId: payload.entityId })
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

            const actualEntityId = typeof entityId === 'object' ? entityId.entity_id : entityId

            // Clear any existing interval for this key
            if (refreshIntervals[key.uid]) {
                clearInterval(refreshIntervals[key.uid])
            }

            // Function to update the key state
            const updateKeyState = async () => {
                try {
                    const entity = await haPlugin.getEntityState({ entityId: actualEntityId })
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
