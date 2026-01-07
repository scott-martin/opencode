import { defineWebSocketHandler } from "h3"

export default defineWebSocketHandler({
  open(peer: any) {
    console.log("[ws] open", peer.id, peer.url)
  },
  close(peer: any) {
    console.log("[ws] close", peer.id)
  },
  error(peer: any, error: any) {
    console.error("[ws] error", peer.id, error)
  },
})
