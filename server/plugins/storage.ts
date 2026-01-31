import fsDriver from 'unstorage/drivers/fs'

export default defineNitroPlugin(() => {
  const driver = process.env.NODE_ENV === 'production'
    ? backendConfig.totps.storage
    : fsDriver({
        base: './.data/storage',
      })

  const storage = useStorage()
  storage.mount('totps', driver)
})
