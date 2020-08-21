const AudiusLibs = require('@audius/libs')

const E = process.env

/**
 * Singleton wrapper for Audius Libs.
 * Initialized in the server start-up.
 */
const libs = new AudiusLibs({
  ethWeb3Config: AudiusLibs.configEthWeb3(
    E.TOKEN_ADDRESS,
    E.ETH_REGISTRY_ADDRESS,
    E.ETH_PROVIDER_URL,
    E.ETH_OWNER_WALLET
  ),
  discoveryProviderConfig: AudiusLibs.configDiscoveryProvider()
})

let discoveryProvider
let isInitting = false
let isInitted = false

const waitForInit = async () => {
  return new Promise(resolve => {
    setInterval(() => {
      if (isInitted) resolve()
    }, 200)
  })
}

const getDiscoveryProvider = async () => {
  if (!discoveryProvider) {
    if (isInitting) {
      await waitForInit()
    }

    isInitting = true
    await libs.init()
    isInitted = true

    discoveryProvider = libs.discoveryProvider.discoveryProviderEndpoint
  }
  return discoveryProvider
}

module.exports = {
  getDiscoveryProvider
}
