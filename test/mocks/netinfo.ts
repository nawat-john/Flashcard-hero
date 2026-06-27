// Stand-in for @react-native-community/netinfo. Tests run "online" so the data
// layer talks to the real Supabase backend (e2e) or its mock (unit).
const NetInfoMock = {
  async fetch(): Promise<{ isConnected: boolean }> {
    return { isConnected: true };
  },
  addEventListener(): () => void {
    return () => {};
  },
};

export default NetInfoMock;
