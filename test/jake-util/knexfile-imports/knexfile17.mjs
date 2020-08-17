import config from '../knexfile-mjs/knexfile.mjs'
/**
 * mjs knexfile provides cjs migrations
 */
export default {
    ...config,
    migrations: {
        ...config.migrations,
        directory: './esm/migrations',
        // loadExtensions defaults to ['.mjs']
    },
    seeds: {
        ...config.seeds,
        directory: './esm/seeds',
    }
}