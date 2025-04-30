const axios = require('axios')

class HomeAssistantPlugin {
  constructor() {
    this.config = null
    this.client = null
  }

  async init() {
    // Load configuration
    this.config = await this.$fd.getConfig()
    if (!this.config || !this.config.url || !this.config.apiKey) {
      console.error('Home Assistant configuration is missing')
      return
    }

    // Initialize axios client
    this.client = axios.create({
      baseURL: this.config.url,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })
  }

  async getEntityState({ entityId }) {
    try {
      const response = await this.client.get(`/api/states/${entityId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching entity state:', error)
      throw error
    }
  }

  async onConfigUpdate(newConfig) {
    this.config = newConfig
    // Reinitialize the client with new configuration
    this.client = axios.create({
      baseURL: this.config.url,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })
  }
}

module.exports = HomeAssistantPlugin 