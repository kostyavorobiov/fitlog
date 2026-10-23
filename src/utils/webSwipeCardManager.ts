class WebSwipeCardManager {
  private activeId: string | null = null;
  private listeners = new Set<(id: string | null) => void>();

  setActive(id: string | null) {
    this.activeId = id;
    this.listeners.forEach((fn) => {
      try {
        fn(id);
      } catch (err) {
        console.error('[WebSwipeCardManager] Listener error:', err);
      }
    });
  }

  getActiveId(): string | null {
    return this.activeId;
  }

  subscribe(listener: (id: string | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const webSwipeCardManager = new WebSwipeCardManager();
