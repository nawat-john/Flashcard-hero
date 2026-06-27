import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { FolderBrowser } from '@/components/folder-browser';
import { getFolder } from '@/lib/folders';

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const folderId = Number(id);
  const [title, setTitle] = useState('โฟลเดอร์');

  useEffect(() => {
    getFolder(folderId).then((folder) => {
      if (folder) setTitle(folder.name);
    });
  }, [folderId]);

  return (
    <>
      <Stack.Screen options={{ title }} />
      <FolderBrowser folderId={folderId} />
    </>
  );
}
