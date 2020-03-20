const axios = require('axios')

const DISCOVERY_PROVIDER = process.env.DISCOVERY_PROVIDER
const ROOT_AUDIUS_URL = process.env.ROOT_AUDIUS_URL

const TRACKS_ENDPOINT = `${DISCOVERY_PROVIDER}/tracks?with_users=true&id=`
const COLLECTIONS_ENDPOINT = `${DISCOVERY_PROVIDER}/playlists?with_users=true&playlist_id=`
const USERS_ENDPOINT = `${DISCOVERY_PROVIDER}/users?id=`

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

const fetch = async (
  endpoint,
  latestId,
  maxIterations = 2,
  maxConsecutiveFailed = 10
) => {
  let failed = 0
  let iterations = 0

  const items = []

  let fetchId = latestId + 1
  while (failed < maxConsecutiveFailed && iterations < maxIterations) {
    const url = `${endpoint}${fetchId}`

    try {
      const { data: item } = await axios.get(url)
      if (item.error || !item.data || !item.data.length) {
        throw new Error('Not found')
      }

      console.log(`Fetched ${url}`)
      items.push(item.data[0])

      failed = 0
      fetchId += 1
      iterations += 1
    } catch (e) {
      console.error(`Error on ${url}`)
      failed += 1
      fetchId += 1
      iterations += 1
    }
  }

  return { items, latest: latestId + iterations }
}

const fetchTracks = async (latestId, maxIterations, maxConsecutiveFailed) => {
  const { items, latest } = await fetch(TRACKS_ENDPOINT, latestId, maxIterations, maxConsecutiveFailed)
  return {
    items: items.map(item => getTrackUrl(item)),
    latest
  }
}

const fetchCollections = async (latestId, maxIterations, maxConsecutiveFailed) => {
  const { items, latest } = await fetch(COLLECTIONS_ENDPOINT, latestId, maxIterations, maxConsecutiveFailed)
  return {
    items: items.map(item => getCollectionUrl(item)),
    latest
  }
}

const fetchUsers = async (latestId, maxIterations, maxConsecutiveFailed) => {
  const { items, latest } = await fetch(USERS_ENDPOINT, latestId, maxIterations, maxConsecutiveFailed)
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
