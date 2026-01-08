import { createMemo, createSignal, onMount, Show, type ParentProps } from "solid-js"
import { Portal } from "solid-js/web"
import { useNavigate, useParams } from "@solidjs/router"
import { SDKProvider, useSDK } from "@/context/sdk"
import { SyncProvider, useSync } from "@/context/sync"
import { LocalProvider } from "@/context/local"
import { ToolbarSession, TOOLBAR_PORTAL_ID } from "@/components/toolbar"

import { base64Decode } from "@opencode-ai/util/encode"
import { DataProvider } from "@opencode-ai/ui/context"
import { iife } from "@opencode-ai/util/iife"

export default function Layout(props: ParentProps) {
  const params = useParams()
  const navigate = useNavigate()
  const directory = createMemo(() => {
    return base64Decode(params.dir!)
  })

  return (
    <Show when={params.dir} keyed>
      <SDKProvider directory={directory()}>
        <SyncProvider>
          {iife(() => {
            const sync = useSync()
            const sdk = useSDK()
            const respond = (input: {
              sessionID: string
              permissionID: string
              response: "once" | "always" | "reject"
            }) => sdk.client.permission.respond(input)

            const navigateToSession = (sessionID: string) => {
              navigate(`/${params.dir}/session/${sessionID}`)
            }

            const [portalMount, setPortalMount] = createSignal<HTMLElement | null>(null)
            onMount(() => {
              setPortalMount(document.getElementById(TOOLBAR_PORTAL_ID))
            })

            const toolbarKey = createMemo(() => params.id ?? "new")

            return (
              <>
                <Show when={portalMount()}>
                  {(mount) => (
                    <Portal mount={mount()}>
                      <Show when={toolbarKey()} keyed>
                        <ToolbarSession />
                      </Show>
                    </Portal>
                  )}
                </Show>
                <DataProvider
                  data={sync.data}
                  directory={directory()}
                  onPermissionRespond={respond}
                  onNavigateToSession={navigateToSession}
                >
                  <LocalProvider>{props.children}</LocalProvider>
                </DataProvider>
              </>
            )
          })}
        </SyncProvider>
      </SDKProvider>
    </Show>
  )
}
