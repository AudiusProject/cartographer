const axios = require('axios')
const { getDiscoveryProvider } = require('./libs')

const ROOT_AUDIUS_URL = process.env.ROOT_AUDIUS_URL

const getTracksEndpoint = discprov => `${discprov}/tracks?with_users=true&id=`
const getCollectionsEndpoint = discprov => `${discprov}/playlists?with_users=true&playlist_id=`
const getUsersEndpoint = discprov => `${discprov}/users?id=`

const getMaxTrackEndpoint = discprov => `${discprov}/latest/track`
const getMaxCollectionEndpoint = discprov => `${discprov}/latest/playlist`
const getMaxUserEndpoint = discprov => `${discprov}/latest/user`

// Copied from DApp
const formatUrlName = (name) => {
  if (!name) return ''
  return name
    .replace(/!|%|#|\$|&|'|\(|\)|&|\*|\+|,|\/|:|;|=|\?|@|\[|\]/g, '')
    .replace(/\s+/g, '-')
    // Reduce repeated `-` to a single `-`
    .replace(/-+/g, '-')
    .toLowerCase()
}

const getTrackUrl = (track) => {
  const slug = `${track.user.handle}/${encodeURI(formatUrlName(track.title))}-${track.track_id}`
  return `${ROOT_AUDIUS_URL}/${slug}`
}

const getCollectionUrl = (collection) => {
  const type = collection.is_album ? 'album' : 'playlist'
  const routeId = `${encodeURI(formatUrlName(collection.playlist_name))}-${collection.playlist_id}`
  const slug = `${collection.user.handle}/${type}/${routeId}`
  return `${ROOT_AUDIUS_URL}/${slug}`
}

const getUserUrl = (user) => {
  const slug = `${user.handle}`
  return `${ROOT_AUDIUS_URL}/${slug}`
}

const getStoppingPoint = async (url) => {
  try {
    const { data } = await axios.get(url)
    return data.data
  } catch (e) {
    console.error('Failed to fetch stopping point', url)
    console.error(e)
    return 0
  }
}

const fetch = async (
  endpoint,
  latestId,
  maxId,
  maxIterations = 2
) => {
  let iterations = 0

  const items = []

  let fetchId = latestId + 1
  while (iterations < maxIterations && fetchId <= maxId) {
    const url = `${endpoint}${fetchId}`

    try {
      const { data: item } = await axios.get(url)
      if (item.error || !item.data || !item.data.length) {
        throw new Error('Not found')
      }

      console.log(`Fetched ${url}`)
      items.push(item.data[0])

      fetchId += 1
      iterations += 1
    } catch (e) {
      console.error(`Error on ${url}`)
      fetchId += 1
      iterations += 1
    }
  }

  return { items, latest: latestId + iterations }
}

const fetchTracks = async (latestId, maxIterations) => {
  const discoveryProvider = await getDiscoveryProvider()
  const maxId = await getStoppingPoint(getMaxTrackEndpoint(discoveryProvider))
  const { items, latest } = await fetch(getTracksEndpoint(discoveryProvider), latestId, maxId, maxIterations)
  return {
    items: items.map(item => getTrackUrl(item)),
    latest
  }
}

const fetchCollections = async (latestId, maxIterations) => {
  const discoveryProvider = await getDiscoveryProvider()
  const maxId = await getStoppingPoint(getMaxCollectionEndpoint(discoveryProvider))
  const { items, latest } = await fetch(getCollectionsEndpoint(discoveryProvider), latestId, maxId, maxIterations)
  return {
    items: items.map(item => getCollectionUrl(item)),
    latest
  }
}

const fetchUsers = async (latestId, maxIterations) => {
  const discoveryProvider = await getDiscoveryProvider()
  const maxId = await getStoppingPoint(getMaxUserEndpoint(discoveryProvider))
  const { items, latest } = await fetch(getUsersEndpoint(discoveryProvider), latestId, maxId, maxIterations)
  return {
    items: items.map(item => getUserUrl(item)),
    latest
  }
}

module.exports = {
  fetchTracks,
  fetchCollections,
  fetchUsers
}
