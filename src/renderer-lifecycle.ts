export interface MountedRecord {
  readonly nodes: readonly unknown[]
  dispose(): void
}

export interface MutableMountedRecord extends MountedRecord {
  setNodes(nodes: readonly unknown[]): void
}

export class RecordState implements MutableMountedRecord {
  private currentNodes: readonly unknown[] = []
  private disposed = false

  constructor(
    private readonly onNodesChanged: (
      nodes: readonly unknown[],
    ) => void,
    private readonly disposeCallback: () => void,
  ) {}

  get nodes(): readonly unknown[] {
    return this.currentNodes
  }

  setNodes(nodes: readonly unknown[]): void {
    if (this.disposed) {
      return
    }

    if (
      this.currentNodes.length === nodes.length &&
      this.currentNodes.every(
        (node, index) => node === nodes[index],
      )
    ) {
      return
    }

    this.currentNodes = [...nodes]
    this.onNodesChanged(this.currentNodes)
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
    try {
      this.disposeCallback()
    }
    finally {
      this.currentNodes = []
      this.onNodesChanged(this.currentNodes)
    }
  }
}
