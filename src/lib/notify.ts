import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

/** Cross-platform confirm. Returns true if user confirmed. */
export async function confirmAction(options: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    destructive = false,
  } = options;

  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    return typeof window !== 'undefined' ? window.confirm(text) : false;
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
