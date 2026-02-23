export default {
  parseWarband(data) {
    return JSON.parse(data.data.warband_data)
  }
}