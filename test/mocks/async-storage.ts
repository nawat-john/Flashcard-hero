// In-memory stand-in for @react-native-async-storage/async-storage so the data
// layer (which persists the offline mirror) runs under Node in tests.
const memory = new Map<string, string>();

const AsyncStorageMock = {
  async getItem(key: string): Promise<string | null> {
    return memory.has(key) ? (memory.get(key) as string) : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    memory.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    memory.delete(key);
  },
  async clear(): Promise<void> {
    memory.clear();
  },
  async getAllKeys(): Promise<string[]> {
    return [...memory.keys()];
  },
};

export default AsyncStorageMock;
