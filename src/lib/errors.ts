const FIREBASE_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'E-mail inválido.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/user-not-found': 'Usuário não encontrado.',
  'auth/wrong-password': 'Senha incorreta.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/email-already-in-use': 'Este e-mail já está em uso.',
  'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
  'auth/network-request-failed': 'Falha de rede. Verifique sua conexão.',
  'auth/popup-closed-by-user': 'Login cancelado.',
  'permission-denied': 'Sem permissão para esta ação.',
  'unavailable': 'Serviço temporariamente indisponível.',
  'not-found': 'Registro não encontrado.',
  'already-exists': 'Este registro já existe.',
  'storage/unauthorized': 'Sem permissão para enviar arquivos.',
  'storage/canceled': 'Upload cancelado.',
  'storage/unknown': 'Erro ao enviar arquivo.',
  'storage/object-not-found': 'Arquivo não encontrado.',
  'storage/quota-exceeded': 'Limite de armazenamento excedido.',
};

export function getErrorMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.') {
  if (!error) return fallback;

  if (typeof error === 'string' && error.trim()) return error;

  const anyErr = error as {
    code?: string;
    message?: string;
    customData?: { message?: string };
  };

  if (anyErr?.code && FIREBASE_MESSAGES[anyErr.code]) {
    return FIREBASE_MESSAGES[anyErr.code]!;
  }

  // Firestore sometimes nests code in message like "FirebaseError: ..."
  const codeFromMessage = anyErr?.message?.match(/\(([^)]+)\)/)?.[1];
  if (codeFromMessage && FIREBASE_MESSAGES[codeFromMessage]) {
    return FIREBASE_MESSAGES[codeFromMessage]!;
  }

  if (anyErr?.message && !anyErr.message.startsWith('Firebase:')) {
    return anyErr.message;
  }

  if (anyErr?.message) {
    const cleaned = anyErr.message
      .replace(/^Firebase:\s*/i, '')
      .replace(/\s*\([^)]*\)\.?\s*$/, '')
      .trim();
    if (cleaned) return cleaned;
  }

  return fallback;
}
