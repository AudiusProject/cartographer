<p align="center">
  <img src="https://user-images.githubusercontent.com/2731362/77206274-caa93b00-6ab3-11ea-917f-1dd18da6a4b4.png" alt="stems" width="340">

  <p align="center">
    <a href="https://audius.co/sitemaps/index.xml">audius.co</a> sitemap generator
  </p>
</p>

<br/>

## Run

The Cartographer sitemap generator is a node script that runs and is stateful on the presence of a local `/sitemaps` directory.

Given the existence of sitemaps in the `sitemaps/` directory and the `sitemaps/latest.yml` config, Cartographer will crawl an Audius discovery provider, indexing new entries into the `/sitemaps` folder, which can then be persisted and served.

Example usage:
```bash
# Pull the staging sitemaps down
npm run pull:staging

# Run Cartographer
#  count: maximum number of each tracks, collections, and users fetch
npm run start:staging -- --count=1000

# Sync your changes to staging
npm run sync:staging
```

The same series of commands can be run with :production instead of staging.

Be careful when doing that!

You can also wipe your local `sitemaps/` folder with

```
npm run reset
```

### Notes

> In Cartographer's current form, it only crawls forward and doesn't re-index things it has already re-indexed. To reindex the entirety of audius, reset and regenerate the entire sitemap.

## CI

The sitemap generator runs in circleci every hour with --count=1000

That config can be found in ./circleci/config.yml

## Deployment

The sitemap generator outputs the following directory structure

```
sitemaps
│   index.xml
|
└───tracks
│   │   index.xml
│   │   1.xml  // Max 50K entries
|   |   2.xml
|   |   ...
└───collections
│   │   index.xml
│   │   1.xml
|   |   2.xml
|   |   ...
└───users
│   │   index.xml
│   │   1.xml
|   |   2.xml
|   |   ...
```

Depending on the crawler, the root index.xml file may not be able to be provided (as nested indexes aren't supported) and robots.txt files should list each index file for tracks, collections, and users.
