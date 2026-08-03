import { Platform, Share } from 'react-native';

/** Download on web; open the native share sheet with CSV text on mobile. */
export async function exportCsvFile(filename: string, content: string): Promise<void> {
  const withBom = `\uFEFF${content}`;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([withBom], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return;
  }

  const result = await Share.share({
    title: filename,
    message: content,
  });
  if (result.action === Share.dismissedAction) {
    throw new Error('EXPORT_CANCELLED');
  }
}
