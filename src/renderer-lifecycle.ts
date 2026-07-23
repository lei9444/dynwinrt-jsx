export interface MountedRecord {
  readonly nodes: readonly unknown[]
  readonly disposed: boolean
  dispose(): void
}

export interface MutableMountedRecord extends MountedRecord {
  setNodes(nodes: readonly unknown[]): void
}

export class RecordState implements MutableMountedRecord {
  private currentNodes: readonly unknown[] = []
  private isDisposed = false

  constructor(
    private readonly onNodesChanged: (
      nodes: readonly unknown[],
    ) => void,
    private readonly disposeCallback: () => void,
    private readonly retryOnDisposeError = false,
  ) {}

  get nodes(): readonly unknown[] {
    return this.currentNodes
  }

  get disposed(): boolean {
    return this.isDisposed
  }

  setNodes(nodes: readonly unknown[]): void {
    if (this.isDisposed) {
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
    if (this.isDisposed) {
      return
    }

    if (this.retryOnDisposeError) {
      this.disposeCallback()
      this.isDisposed = true
      this.currentNodes = []
      this.onNodesChanged(this.currentNodes)
      return
    }

    this.isDisposed = true
    try {
      this.disposeCallback()
    }
    finally {
      this.currentNodes = []
      this.onNodesChanged(this.currentNodes)
    }
  }
}
