import { describe, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { Binary } from "@opencode-ai/util/binary"

/**
 * Tests for understanding part ordering behavior in the TUI.
 * 
 * The TUI stores parts in an array and uses Binary.search to:
 * 1. Find existing parts to update them in place
 * 2. Insert new parts at the sorted position
 * 
 * Parts are sorted by ID, and IDs are generated with Identifier.ascending()
 * which should produce monotonically increasing, sortable strings.
 */

describe("Part ID generation", () => {
  test("ascending IDs sort in creation order", () => {
    const ids: string[] = []
    for (let i = 0; i < 10; i++) {
      ids.push(Identifier.ascending("part"))
    }
    
    const sorted = [...ids].sort()
    expect(ids).toEqual(sorted)
  })

  test("IDs created at different times sort chronologically", async () => {
    const id1 = Identifier.ascending("part")
    await new Promise(r => setTimeout(r, 10))
    const id2 = Identifier.ascending("part")
    await new Promise(r => setTimeout(r, 10))
    const id3 = Identifier.ascending("part")
    
    expect(id1 < id2).toBe(true)
    expect(id2 < id3).toBe(true)
  })
})

describe("Binary.search insertion", () => {
  test("inserts parts in ID-sorted order", () => {
    const parts: { id: string; type: string }[] = []
    
    // Simulate parts arriving in order: text1, tool, text2
    const text1Id = Identifier.ascending("part")
    const toolId = Identifier.ascending("part")
    const text2Id = Identifier.ascending("part")
    
    // Insert in arrival order
    for (const part of [
      { id: text1Id, type: "text1" },
      { id: toolId, type: "tool" },
      { id: text2Id, type: "text2" },
    ]) {
      const result = Binary.search(parts, part.id, p => p.id)
      if (!result.found) {
        parts.splice(result.index, 0, part)
      }
    }
    
    // Parts should be in ID order (which equals creation order)
    expect(parts.map(p => p.type)).toEqual(["text1", "tool", "text2"])
  })

  test("handles out-of-order arrival", () => {
    const parts: { id: string; type: string }[] = []
    
    // Create IDs in order
    const text1Id = Identifier.ascending("part")
    const toolId = Identifier.ascending("part")
    const text2Id = Identifier.ascending("part")
    
    // Insert in WRONG order: tool, text2, text1
    for (const part of [
      { id: toolId, type: "tool" },
      { id: text2Id, type: "text2" },
      { id: text1Id, type: "text1" },
    ]) {
      const result = Binary.search(parts, part.id, p => p.id)
      if (!result.found) {
        parts.splice(result.index, 0, part)
      }
    }
    
    // Parts should still be in ID order (chronological)
    expect(parts.map(p => p.type)).toEqual(["text1", "tool", "text2"])
  })

  test("updates existing part in place", () => {
    const parts: { id: string; type: string; status: string }[] = []
    
    const toolId = Identifier.ascending("part")
    
    // Insert initial part
    parts.push({ id: toolId, type: "tool", status: "pending" })
    
    // Update to running
    const result = Binary.search(parts, toolId, p => p.id)
    expect(result.found).toBe(true)
    parts[result.index] = { id: toolId, type: "tool", status: "running" }
    
    // Verify update
    expect(parts[0].status).toBe("running")
    expect(parts.length).toBe(1)
  })
})

describe("Part ordering with reversal", () => {
  test("reversing parts puts newest first", () => {
    const parts = [
      { id: "prt_001", type: "text1" },
      { id: "prt_002", type: "tool" },
      { id: "prt_003", type: "text2" },
    ]
    
    const reversed = [...parts].reverse()
    
    expect(reversed.map(p => p.type)).toEqual(["text2", "tool", "text1"])
  })

  test("double reversal restores original order", () => {
    const parts = [
      { id: "prt_001", type: "text1" },
      { id: "prt_002", type: "tool" },
      { id: "prt_003", type: "text2" },
    ]
    
    const reversed = [...parts].reverse()
    const doubleReversed = [...reversed].reverse()
    
    expect(doubleReversed.map(p => p.type)).toEqual(["text1", "tool", "text2"])
  })
})

/**
 * This test simulates what we observed: even with correct ID ordering,
 * the display was reversed. This helps verify our understanding.
 */
describe("Simulated TUI behavior", () => {
  test("parts in store should be ID-sorted (oldest first)", () => {
    // Simulate sync store state
    const store = {
      part: {} as Record<string, { id: string; type: string }[]>
    }
    
    const messageId = "msg_001"
    store.part[messageId] = []
    
    // Simulate events arriving in order
    const events = [
      { id: Identifier.ascending("part"), type: "text" },
      { id: Identifier.ascending("part"), type: "tool" },
      { id: Identifier.ascending("part"), type: "text" },
    ]
    
    for (const event of events) {
      const parts = store.part[messageId]
      const result = Binary.search(parts, event.id, p => p.id)
      if (!result.found) {
        parts.splice(result.index, 0, event)
      }
    }
    
    // Store has parts in chronological order
    expect(store.part[messageId].map(p => p.type)).toEqual(["text", "tool", "text"])
  })

  test("with message_flow down, parts get reversed for display", () => {
    const parts = [
      { id: "prt_001", type: "text1" },  // oldest
      { id: "prt_002", type: "tool" },
      { id: "prt_003", type: "text2" },  // newest
    ]
    
    const messageFlowDown = true
    const partsToRender = messageFlowDown ? [...parts].reverse() : parts
    
    // With reversal, newest is first (top of screen)
    expect(partsToRender.map(p => p.type)).toEqual(["text2", "tool", "text1"])
  })
})
