type SwipeListener = (activeId: string | null) => void;

class SwipeCardManager {
  private activeId: string | null = null;
  private listeners: Set<SwipeListener> = new Set();

  subscribe(listener: SwipeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setActive(id: string | null): void {
    if (this.activeId !== id) {
      this.activeId = id;
      this.listeners.forEach((listener) => {
        try {
          listener(id);
        } catch (e) {
          console.warn('[SwipeCardManager] Error calling listener:', e);
        }
      });
    }
  }

  getActiveId(): string | null {
    return this.activeId;
  }

  hasActiveCard(): boolean {
    return this.activeId !== null;
  }

  closeAll(): void {
    this.setActive(null);
  }
}

export const swipeCardManager = new SwipeCardManager();
