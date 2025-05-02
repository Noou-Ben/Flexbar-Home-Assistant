# Home Assistant Plugin for Flexbar

This plugin integrates Home Assistant with Flexbar, allowing you to monitor and control your smart home devices directly from your Flexbar.

## Features

- Monitor entity states in real-time
- Call Home Assistant services
- Trigger Home Assistant events
- Customizable titles and displays

## Installation

1. Download the plugin files
2. Install in Flexbar
3. Configure your Home Assistant connection settings

## Configuration

1. Open Flexbar settings
2. Navigate to the Home Assistant plugin configuration
3. Enter your Home Assistant URL and API key

## Usage

### Entity State Monitoring
- Add an Entity State key
- Select the entity you want to monitor
- The state will update automatically

### Service Calls
- Add a Service Call key
- Enter the domain and service name
- Specify service data in JSON format
- Click to execute

### Event Triggers 
- Add an Event Trigger key
- Enter the event type
- Specify event data in JSON format
- Click to trigger

## Requirements

- Flexbar 1.0.0 or higher
- Home Assistant instance with API access
- Network connectivity between Flexbar and Home Assistant

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/Noou-Ben/Flexbar-Home-Assistant).

## Changelog
### 1.0.1 (2025-05-02)
- Improved error handling for API connection failures
- Enhanced feedback messages for configuration issues

### 1.0.0 (2025-04-30)
- Initial release
- Entity state monitoring functionality
- Service call integration
- Event trigger support
- Real-time state updates
- Customizable display options
- Basic error handling
