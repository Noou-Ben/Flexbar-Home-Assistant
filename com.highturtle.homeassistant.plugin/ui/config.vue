<template>
  <v-container>
    <v-card prepend-icon="mdi-home-assistant" title="Home Assistant Settings">
      <v-card-text>
        <v-form ref="form" v-model="valid">
          <v-text-field
            v-model="modelValue.config.url"
            label="Home Assistant URL"
            :rules="urlRules"
            required
            hint="Enter your Home Assistant URL (e.g., http://homeassistant.local:8123)"
            persistent-hint
            outlined
            hide-details
          ></v-text-field>

          <v-text-field
            v-model="modelValue.config.apiKey"
            label="API Key"
            :rules="apiKeyRules"
            required
            :type="showApiKey ? 'text' : 'password'"
            :append-icon="showApiKey ? 'mdi-eye' : 'mdi-eye-off'"
            @click:append="showApiKey = !showApiKey"
            hint="Enter your Home Assistant API key"
            persistent-hint
            outlined
            hide-details
          ></v-text-field>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" icon @click="saveConfig">
          <v-icon>mdi-check-circle-outline</v-icon>
        </v-btn>
      </v-card-actions>
    </v-card>
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
  data() {
    return {
      valid: false,
      showApiKey: false,
      urlRules: [
        v => !!v || 'URL is required',
        v => /^https?:\/\/.+/i.test(v) || 'URL must be valid (e.g., http://homeassistant.local:8123)'
      ],
      apiKeyRules: [
        v => !!v || 'API key is required',
        v => v.length >= 32 || 'API key must be at least 32 characters'
      ]
    }
  },
  methods: {
    saveConfig() {
      if (this.$refs.form.validate()) {
        this.$fd.setConfig(this.modelValue.config)
        this.$fd.showSnackbarMessage("success", 'Settings saved successfully')
      }
    }
  }
}
</script>

<style scoped>
.v-card {
  margin: 16px;
}
</style> 