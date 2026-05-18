import Pusher from 'pusher'

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
})

export default pusher

export function triggerUserChannel(userId, event, payload) {
  const channel = `private-user-${userId}`
  return pusher.trigger(channel, event, payload)
}
